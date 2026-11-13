import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection';
import { auditLog } from './auditLogger';

export const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

export function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function computeFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function createZipArchive(zipPath: string, data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });
    archive.finalize();
  });
}

export async function createArchiveSnapshot(params: {
  module: string;
  date_from?: string;
  date_to?: string;
  emp_id?: string;
  reason: string;
  userId: number;
  username: string;
  req?: any;
}) {
  const { module, date_from, date_to, emp_id, reason, userId, username, req } = params;
  ensureBackupDir();
  const archiveId = uuidv4();
  const archiveName = `archive_${module}_${date_from || 'all'}_${date_to || 'all'}_${archiveId.substring(0, 8)}`;
  const zipPath = path.join(BACKUP_DIR, `${archiveName}.zip`);

  const [result] = await pool.query<any>(
    `INSERT INTO data_archives (archive_name, module, date_from, date_to, emp_id, file_path, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'creating', ?)`,
    [archiveName, module, date_from || null, date_to || null, emp_id || null, zipPath, userId]
  );
  const archiveDbId = result.insertId;
  const exportData: any = { metadata: { module, date_from, date_to, emp_id, archived_at: new Date(), archived_by: username, reason }, records: {} };

  if (module === 'attendance' || module === 'all') {
    let q = 'SELECT * FROM attendance_records WHERE is_archived = 0';
    const p: any[] = [];
    if (date_from) { q += ' AND date >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND date <= ?'; p.push(date_to); }
    const [rows] = await pool.query<any[]>(q, p);
    exportData.records.attendance = rows;
  }

  if (module === 'salary' || module === 'all') {
    let q = 'SELECT se.* FROM salary_entries se JOIN salary_periods sp ON se.period_id = sp.id WHERE 1=1';
    const p: any[] = [];
    if (date_from) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") >= ?'; p.push(date_from); }
    if (date_to) { q += ' AND STR_TO_DATE(CONCAT(sp.year,"-",sp.month,"-01"), "%Y-%m-%d") <= ?'; p.push(date_to); }
    const [rows] = await pool.query<any[]>(q, p);
    exportData.records.salary = rows;
  }

  await createZipArchive(zipPath, exportData);
  const stats = fs.statSync(zipPath);
  const checksum = await computeFileChecksum(zipPath);
  const totalRecords = Object.values(exportData.records as Record<string, any[]>).reduce((sum, arr) => sum + arr.length, 0);

  await pool.query(
    `UPDATE data_archives SET status='ready', record_count=?, file_size_bytes=?, checksum=?, verified=1, verified_at=NOW() WHERE id=?`,
    [totalRecords, stats.size, checksum, archiveDbId]
  );
  await auditLog(userId, username, 'archive', module, archiveDbId, archiveName, { total_records: totalRecords }, reason, req);

  return { archiveDbId, archiveName, checksum, totalRecords, zipPath };
}

export function sanitizeRecordValues(rec: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/i.test(v)) {
        sanitized[k] = v.replace('T', ' ').replace(/\.\d+Z?$/i, '').replace(/Z$/i, '');
      } else {
        sanitized[k] = v;
      }
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}
