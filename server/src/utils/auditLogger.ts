import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection';

export async function auditLog(
  userId: number | null,
  username: string | null,
  action: string,
  module: string,
  recordId: number | null,
  recordRef: string | null,
  details: object | null,
  reason: string | null,
  req?: Request,
  status: 'success' | 'failed' = 'success'
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (user_id, username, action, module, record_id, record_ref, details, reason, ip_address, user_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        action ? action.toLowerCase().trim() : 'action',
        module,
        recordId,
        recordRef,
        details ? JSON.stringify(details) : null,
        reason,
        req?.ip || req?.headers['x-forwarded-for'] || null,
        req?.headers['user-agent'] || null,
        status,
      ]
    );
  } catch (err) {
    // Audit logging should never crash the app
    console.error('Audit log error:', err);
  }
}
