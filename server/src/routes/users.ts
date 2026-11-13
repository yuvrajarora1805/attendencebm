import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';

const router = Router();
router.use(authenticate);
router.use(authorizeRoles('admin'));

// GET /api/users
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT id, username, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/users
import bcrypt from 'bcryptjs';
router.post('/', async (req: Request, res: Response) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    res.status(400).json({ success: false, message: 'All fields required' });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query<any>(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, full_name, role]
    );
    await auditLog(req.user!.id, req.user!.username, 'create', 'users', result.insertId, username, { role }, null, req);
    res.status(201).json({ success: true, message: 'User created', id: result.insertId });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') { res.status(409).json({ success: false, message: 'Username already exists' }); return; }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { full_name, role, is_active, new_password } = req.body;
  try {
    if (new_password) {
      const hash = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET full_name=?, role=?, is_active=?, password_hash=? WHERE id=?', [full_name, role, is_active ? 1 : 0, hash, req.params.id]);
    } else {
      await pool.query('UPDATE users SET full_name=?, role=?, is_active=? WHERE id=?', [full_name, role, is_active ? 1 : 0, req.params.id]);
    }
    await auditLog(req.user!.id, req.user!.username, 'edit', 'users', parseInt(req.params.id), null, { role, is_active }, null, req);
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
