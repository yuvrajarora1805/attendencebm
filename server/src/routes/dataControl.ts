import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';
import { computeFileChecksum, createArchiveSnapshot, sanitizeRecordValues } from '../utils/archiveHelper';
import { getServerCoverageReport } from '../utils/coverageHelper';
import fs from 'fs';
import AdmZip from 'adm-zip';

const router = Router();
router.use(authenticate, authorizeRoles('admin'));

// GET Coverage & Attached Devices Report
router.get('/coverage', async (_req: Request, res: Response) => {
  try {
    const report = await getServerCoverageReport();
    res.json({ success: true, ...report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate coverage report' });
  }
});

// Step 1: Preview records before archive/delete
router.post('/preview', async (req: Request, res: Response) => {
  const { module, date_from, date_to, emp_id } = req.body;
  try {
    const preview: any = {};
    if (module === 'attendance' || module === 'all') {
      let q = 'SELECT COUNT(*) as count FROM attendance_records WHERE is_archived = 0';
      const p: any[] = [];
      if (date_from) { q += ' AND date >= ?'; p.push(date_from); }
      if (date_to) { q += ' AND date <= ?'; p.push(date_to); }
      if (emp_id) { q += ' AND emp_id = ?'; p.push(emp_id); }
      const [r] = await pool.query<any[]>(q, p);
      preview.attendance = r[0].count;
    }
    if (module === 'salary' || module === 'all') {
      let q = 'SELECT COUNT(*) as count FROM salary_entries se JOIN salary_periods sp ON se.period_id = sp.id WHERE 1=1';
      const p: any[] = [];
      if (date_from) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") >= ?'; p.push(date_from); }
      if (date_to) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") <= ?'; p.push(date_to); }
      if (emp_id) { q += ' AND se.emp_id = ?'; p.push(emp_id); }
      const [r] = await pool.query<any[]>(q, p);
      preview.salary = r[0].count;
    }
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Step 2: Create archive snapshot
router.post('/archive', async (req: Request, res: Response) => {
  const { module, date_from, date_to, emp_id, reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required for archiving' });
  try {
    const result = await createArchiveSnapshot({
      module, date_from, date_to, emp_id, reason, userId: req.user!.id, username: req.user!.username, req
    });
    res.json({ success: true, archive_id: result.archiveDbId, archive_name: result.archiveName, checksum: result.checksum, record_count: result.totalRecords });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Archive creation failed' });
  }
});

// Direct Delete Data from Server (with auto-archive snapshot for safety)
router.post('/delete-direct', async (req: Request, res: Response) => {
  const { module, date_from, date_to, confirm_text, reason } = req.body;
  if (confirm_text !== 'DELETE CONFIRMED') return res.status(400).json({ success: false, message: 'Type "DELETE CONFIRMED" to proceed' });
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });

  try {
    // 1. Auto safety snapshot before deletion
    const snap = await createArchiveSnapshot({
      module, date_from, date_to, reason: `Auto-snapshot before direct delete: ${reason}`,
      userId: req.user!.id, username: req.user!.username, req
    });

    // 2. Perform deletion
    let deleted = 0;
    if (module === 'attendance' || module === 'all') {
      const p: any[] = [];
      let q = 'DELETE FROM attendance_records WHERE is_archived = 0';
      if (date_from) { q += ' AND date >= ?'; p.push(date_from); }
      if (date_to) { q += ' AND date <= ?'; p.push(date_to); }
      const [r] = await pool.query<any>(q, p);
      deleted += r.affectedRows;
    }
    if (module === 'salary' || module === 'all') {
      const p: any[] = [];
      let q = 'DELETE se FROM salary_entries se JOIN salary_periods sp ON se.period_id = sp.id WHERE 1=1';
      if (date_from) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") >= ?'; p.push(date_from); }
      if (date_to) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") <= ?'; p.push(date_to); }
      const [r] = await pool.query<any>(q, p);
      deleted += r.affectedRows;
    }

    await pool.query('UPDATE data_archives SET status="deleted" WHERE id=?', [snap.archiveDbId]);
    await auditLog(req.user!.id, req.user!.username, 'delete_direct', module, snap.archiveDbId, snap.archiveName, { deleted_count: deleted }, reason, req);

    res.json({
      success: true,
      message: `Safely deleted ${deleted} records from server. (Safety archive #${snap.archiveDbId} created & verified).`,
      deleted_count: deleted,
      archive_id: snap.archiveDbId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Direct deletion failed' });
  }
});

// Step 3: Delete after archive verification
router.post('/delete-archived', async (req: Request, res: Response) => {
  const { archive_id, confirm_text, reason } = req.body;
  if (confirm_text !== 'DELETE CONFIRMED') return res.status(400).json({ success: false, message: 'Type "DELETE CONFIRMED" to proceed' });
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });

  try {
    const [archives] = await pool.query<any[]>('SELECT * FROM data_archives WHERE id = ?', [archive_id]);
    if (!archives.length) return res.status(404).json({ success: false, message: 'Archive not found' });
    const archive = archives[0];

    if (!archive.verified || !fs.existsSync(archive.file_path)) return res.status(400).json({ success: false, message: 'Archive invalid or missing.' });
    const currentChecksum = await computeFileChecksum(archive.file_path);
    if (currentChecksum !== archive.checksum) return res.status(400).json({ success: false, message: 'Checksum mismatch! Deletion blocked.' });

    let deleted = 0;
    if (archive.module === 'attendance' || archive.module === 'all') {
      const p: any[] = [];
      let q = 'DELETE FROM attendance_records WHERE is_archived = 0';
      if (archive.date_from) { q += ' AND date >= ?'; p.push(archive.date_from); }
      if (archive.date_to) { q += ' AND date <= ?'; p.push(archive.date_to); }
      const [r] = await pool.query<any>(q, p);
      deleted += r.affectedRows;
    }
    if (archive.module === 'salary' || archive.module === 'all') {
      const p: any[] = [];
      let q = 'DELETE se FROM salary_entries se JOIN salary_periods sp ON se.period_id = sp.id WHERE 1=1';
      if (archive.date_from) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") >= ?'; p.push(archive.date_from); }
      if (archive.date_to) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") <= ?'; p.push(archive.date_to); }
      const [r] = await pool.query<any>(q, p);
      deleted += r.affectedRows;
    }

    await pool.query('UPDATE data_archives SET status="deleted" WHERE id=?', [archive_id]);
    await auditLog(req.user!.id, req.user!.username, 'delete', archive.module, archive_id, archive.archive_name, { deleted_count: deleted }, reason, req);
    res.json({ success: true, message: `Deleted ${deleted} records from server.`, deleted_count: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Deletion failed' });
  }
});

// Restore from archive
router.post('/restore', async (req: Request, res: Response) => {
  const { archive_id, reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });

  try {
    const [archives] = await pool.query<any[]>('SELECT * FROM data_archives WHERE id = ?', [archive_id]);
    if (!archives.length || !fs.existsSync(archives[0].file_path)) return res.status(404).json({ success: false, message: 'Archive file missing' });
    const archive = archives[0];

    const currentChecksum = await computeFileChecksum(archive.file_path);
    if (currentChecksum !== archive.checksum) return res.status(400).json({ success: false, message: 'Checksum mismatch! Restore blocked.' });

    const zip = new AdmZip(archive.file_path);
    const entry = zip.getEntry('data.json');
    if (!entry) return res.status(400).json({ success: false, message: 'Invalid archive format' });
    const exportData = JSON.parse(entry.getData().toString('utf8'));

    let restored = 0;
    if (exportData.records?.attendance) {
      for (const rec of exportData.records.attendance) {
        const dStr = rec.date ? rec.date.slice(0, 10) : null;
        const pIn = rec.punch_in ? new Date(rec.punch_in) : null;
        const pOut = rec.punch_out ? new Date(rec.punch_out) : null;
        await pool.query(
          `INSERT INTO attendance_records (id, emp_id, date, punch_in, punch_out, status, is_late, late_minutes, overtime_hours, is_archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE punch_in=VALUES(punch_in), punch_out=VALUES(punch_out), status=VALUES(status), is_archived=0`,
          [rec.id, rec.emp_id, dStr, pIn, pOut, rec.status, rec.is_late, rec.late_minutes, rec.overtime_hours]
        );
        restored++;
      }
    }
    if (exportData.records?.salary) {
      for (const rec of exportData.records.salary) {
        const clean = sanitizeRecordValues(rec);
        const keys = Object.keys(clean);
        const placeholders = keys.map(() => '?').join(',');
        const updates = keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(',');
        await pool.query(`INSERT INTO salary_entries (\`${keys.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`, Object.values(clean));
        restored++;
      }
    }

    await pool.query('UPDATE data_archives SET status="restored" WHERE id=?', [archive_id]);
    await auditLog(req.user!.id, req.user!.username, 'restore', archive.module, archive_id, archive.archive_name, { restored }, reason, req);
    res.json({ success: true, message: `Restored ${restored} records to server database.`, restored });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Restore failed' });
  }
});

// GET list of archives
router.get('/archives', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM data_archives ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE archive from server
router.delete('/archives/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM data_archives WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Archive not found' });
    const archive = rows[0];
    if (archive.file_path && fs.existsSync(archive.file_path)) {
      try { fs.unlinkSync(archive.file_path); } catch (_) {}
    }
    await pool.query('DELETE FROM data_archives WHERE id = ?', [id]);
    res.json({ success: true, message: `Archive #${id} deleted from server.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
