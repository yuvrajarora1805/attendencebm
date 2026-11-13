import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection';
import { auditLog } from '../utils/auditLogger';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password required' });
    return;
  }

  try {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (!rows.length) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await auditLog(user.id, user.username, 'login', 'auth', null, null, null, 'Wrong password', req, 'failed');
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const secret = user.role === 'security_guard'
      ? (process.env.JWT_GUARD_SECRET || process.env.JWT_SECRET || 'secret')
      : (process.env.JWT_SECRET || 'secret');

    const expiresIn = user.role === 'security_guard'
      ? (process.env.JWT_GUARD_EXPIRES_IN || '12h')
      : (process.env.JWT_EXPIRES_IN || '8h');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      secret,
      { expiresIn } as any
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await auditLog(user.id, user.username, 'login', 'auth', null, null, null, null, req);

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/me - Validate session token & return fresh user identity
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch {
      decoded = jwt.verify(token, process.env.JWT_GUARD_SECRET || process.env.JWT_SECRET || 'secret');
    }

    const [rows] = await pool.query<any[]>(
      'SELECT id, username, full_name, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Session revoked or user inactive' });
    }

    const user = rows[0];
    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name }
    });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired session token' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  const { username, old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    res.status(400).json({ success: false, message: 'old_password and new_password are required' });
    return;
  }
  if (new_password.length < 6) {
    res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    return;
  }

  // Non-admins can only change their own password
  const targetUsername = (req.user?.role === 'admin' && username) ? username : req.user!.username;

  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE username = ?', [targetUsername]);
    if (!rows.length) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    const user = rows[0];

    // Verify old password (even admins must supply old password for their own account; or if changing own password)
    const isValid = await bcrypt.compare(old_password, user.password_hash);
    if (!isValid) { res.status(401).json({ success: false, message: 'Old password incorrect' }); return; }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
    await auditLog(req.user!.id, req.user!.username, 'edit', 'auth', user.id, 'password_change', null, null, req);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
