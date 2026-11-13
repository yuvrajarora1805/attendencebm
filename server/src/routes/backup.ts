import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import AdmZip from 'adm-zip';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';
import { getConnectedStorageDevices, copyBackupToDrive, listSubfolders, listFolderContents } from '../utils/deviceHelper';
import { sanitizeRecordValues } from '../utils/archiveHelper';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const upload = multer({ dest: BACKUP_DIR });

// GET /api/backup - list snapshots
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT b.*, u.username as created_by_name FROM backup_snapshots b LEFT JOIN users u ON b.created_by = u.id ORDER BY b.created_at DESC');
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backup/devices - scan connected USB & storage devices
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = getConnectedStorageDevices();
    return res.json({ success: true, data: devices });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backup/browse-folders - browse subfolders & backup files inside server backups folder
router.get('/browse-folders', async (req: Request, res: Response) => {
  const reqPath = (req.query.path as string) || BACKUP_DIR;
  const resolved = path.resolve(reqPath);
  const safePath = resolved.startsWith(BACKUP_DIR) ? resolved : BACKUP_DIR;
  const contents = listFolderContents(safePath);
  return res.json({
    success: true,
    data: contents.folders,
    folders: contents.folders,
    backupFiles: contents.backupFiles,
    currentPath: safePath
  });
});

function extractBackupData(filePath: string): any {
  if (filePath.toLowerCase().endsWith('.zip')) {
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry('data.json') || zip.getEntries().find(e => e.entryName.endsWith('.json'));
    if (!entry) throw new Error('No JSON data found inside the ZIP archive');
    return JSON.parse(entry.getData().toString('utf8'));
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

// POST /api/backup/restore-from-path - restore directly from file in server backups
router.post('/restore-from-path', async (req: Request, res: Response) => {
  const { file_path, reason } = req.body;
  if (!file_path) return res.status(400).json({ success: false, message: 'file_path required' });

  try {
    const resolved = path.resolve(file_path.replace(/SN:/g, 'SN%3A'));
    if (!resolved.startsWith(BACKUP_DIR)) {
      return res.status(403).json({ success: false, message: 'Access denied: Outside server backups folder' });
    }
    if (!fs.existsSync(resolved)) return res.status(404).json({ success: false, message: 'Backup file missing' });

    const rawData = extractBackupData(resolved);
    const data = rawData.records ? rawData.records : rawData;
    let totalRestored = 0;

    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || records.length === 0) continue;
        for (const rec of records) {
          const clean = sanitizeRecordValues(rec);
          const keys = Object.keys(clean);
          const placeholders = keys.map(() => '?').join(',');
          const updates = keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(',');
          await pool.query(`INSERT INTO \`${table}\` (\`${keys.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`, Object.values(clean));
          totalRestored++;
        }
      }
    } finally {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    const fileName = path.basename(resolved);
    await auditLog(req.user?.id || null, req.user?.username || null, 'restore', 'system', null, fileName, { totalRestored, file_path: resolved }, `Restored from backup: ${fileName}. Reason: ${reason || 'Direct restore'}`, req);
    return res.json({ success: true, message: `System restored: ${totalRestored} records restored from ${fileName}.`, totalRestored });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/copy-to-device - write snapshot to specific folder in server backups
router.post('/copy-to-device', async (req: Request, res: Response) => {
  const { snapshot_id, target_folder } = req.body;
  if (!snapshot_id) return res.status(400).json({ success: false, message: 'snapshot_id required' });

  try {
    const [rows]: any = await pool.query('SELECT * FROM backup_snapshots WHERE id = ?', [snapshot_id]);
    if (!rows.length || !fs.existsSync(rows[0].file_path)) return res.status(404).json({ success: false, message: 'Backup file missing' });

    const destination = path.resolve(target_folder || BACKUP_DIR);
    if (!destination.startsWith(BACKUP_DIR)) {
      return res.status(403).json({ success: false, message: 'Access denied: Target must be inside server backups folder' });
    }
    const result = copyBackupToDrive(rows[0].file_path, destination);
    await auditLog(req.user?.id || null, req.user?.username || null, 'backup_copy', 'system', snapshot_id, rows[0].snapshot_name, { destination, dest: result.destFile }, `Copied backup to: ${destination}`, req);
    return res.json({ success: true, message: `Backup saved to ${result.destFile}`, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/create - create full JSON snapshot
router.post('/create', async (req: Request, res: Response) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `full_backup_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, snapshotName);
    const tables = ['departments', 'employees', 'work_schedules', 'attendance_records', 'leave_records', 'salary_periods', 'salary_entries', 'advance_transactions', 'system_settings'];

    const backupData: Record<string, any[]> = {};
    for (const t of tables) {
      const [r]: any = await pool.query(`SELECT * FROM \`${t}\``);
      backupData[t] = r;
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf8');
    const fileSizeBytes = fs.statSync(filePath).size;
    const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');

    const [resDb]: any = await pool.query(
      `INSERT INTO backup_snapshots (snapshot_name, type, file_path, file_size_bytes, checksum, verified, verified_at, created_by)
       VALUES (?, 'full', ?, ?, ?, 1, NOW(), ?)`,
      [snapshotName, filePath, fileSizeBytes, checksum, req.user?.id]
    );

    await auditLog(req.user?.id || null, req.user?.username || null, 'backup', 'system', resDb.insertId, snapshotName, { fileSizeBytes }, `Created full database snapshot: ${snapshotName}`, req);
    return res.json({ success: true, message: 'Backup created successfully', data: { id: resDb.insertId, snapshotName, checksum, fileSizeBytes } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/verify/:id - verify checksum
router.post('/verify/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM backup_snapshots WHERE id = ?', [req.params.id]);
    if (!rows.length || !fs.existsSync(rows[0].file_path)) return res.status(404).json({ success: false, message: 'Snapshot file missing' });
    const content = fs.readFileSync(rows[0].file_path);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const isValid = hash === rows[0].checksum;
    await pool.query('UPDATE backup_snapshots SET verified = ?, verified_at = NOW() WHERE id = ?', [isValid ? 1 : 0, req.params.id]);
    return res.json({ success: true, verified: isValid, computed_checksum: hash });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/restore/:id - restore full snapshot
router.post('/restore/:id', async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required for database restore' });

  try {
    const [rows]: any = await pool.query('SELECT * FROM backup_snapshots WHERE id = ?', [req.params.id]);
    if (!rows.length || !fs.existsSync(rows[0].file_path)) return res.status(404).json({ success: false, message: 'Snapshot file not found' });
    const snap = rows[0];
    const buffer = fs.readFileSync(snap.file_path);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hash !== snap.checksum) return res.status(400).json({ success: false, message: 'Checksum mismatch! File corrupted. Restore blocked.' });

    const rawData = extractBackupData(snap.file_path);
    const data = rawData.records ? rawData.records : rawData;
    let totalRestored = 0;
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const [table, records] of Object.entries(data)) {
        if (!Array.isArray(records) || records.length === 0) continue;
        for (const rec of records) {
          const clean = sanitizeRecordValues(rec);
          const keys = Object.keys(clean);
          const placeholders = keys.map(() => '?').join(',');
          const updates = keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(',');
          await pool.query(`INSERT INTO \`${table}\` (\`${keys.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`, Object.values(clean));
          totalRestored++;
        }
      }
    } finally {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    await auditLog(req.user?.id || null, req.user?.username || null, 'restore', 'system', snap.id, snap.snapshot_name, { totalRestored }, `Restored full database from: ${snap.snapshot_name}. Reason: ${reason}`, req);
    return res.json({ success: true, message: `Full system restore complete: ${totalRestored} records restored.`, totalRestored });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/backup/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  try {
    const originalName = req.file.originalname || `uploaded_${Date.now()}.json`;
    const finalPath = path.join(BACKUP_DIR, originalName);
    fs.renameSync(req.file.path, finalPath);
    const buffer = fs.readFileSync(finalPath);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileSizeBytes = fs.statSync(finalPath).size;
    const [resDb]: any = await pool.query('INSERT INTO backup_snapshots (snapshot_name, type, file_path, file_size_bytes, checksum, verified, verified_at, created_by) VALUES (?, "full", ?, ?, ?, 1, NOW(), ?)', [originalName, finalPath, fileSizeBytes, checksum, req.user?.id]);
    return res.json({ success: true, message: 'Backup file uploaded and registered', id: resDb.insertId, snapshot_id: resDb.insertId });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/backup/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM backup_snapshots WHERE id = ?', [req.params.id]);
    if (rows.length && fs.existsSync(rows[0].file_path)) { try { fs.unlinkSync(rows[0].file_path); } catch {} }
    await pool.query('DELETE FROM backup_snapshots WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Backup snapshot deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/backup/download/:id
router.get('/download/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM backup_snapshots WHERE id = ?', [req.params.id]);
    if (!rows.length || !fs.existsSync(rows[0].file_path)) return res.status(404).json({ success: false, message: 'Backup file not found' });
    return res.download(rows[0].file_path, rows[0].snapshot_name);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
