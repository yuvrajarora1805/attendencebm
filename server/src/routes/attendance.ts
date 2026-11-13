import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';

const router = Router();
router.use(authenticate);

// POST /api/attendance/punch - Guard, Manager, HR punches in/out
router.post('/punch', async (req: Request, res: Response) => {
  if (!['admin', 'hr', 'security_guard', 'guard', 'manager'].includes(req.user!.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized to punch' });
  }

  const { emp_code, action, punch_time, punch_date, notes } = req.body;
  if (!emp_code || !action) return res.status(400).json({ success: false, message: 'emp_code and action required' });

  try {
    const [empRows] = await pool.query<any[]>('SELECT * FROM employees WHERE emp_code = ? AND status = "active"', [emp_code]);
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found or inactive' });
    const emp = empRows[0];
    
    // Support custom punch time / date if provided by manager/admin
    let punchDateStr = punch_date;
    let punchDateTime: Date;
    if (punch_time) {
      if (punch_time.includes('T')) {
        punchDateTime = new Date(punch_time);
        punchDateStr = punchDateTime.toISOString().split('T')[0];
      } else {
        punchDateStr = punch_date || new Date().toISOString().split('T')[0];
        punchDateTime = new Date(`${punchDateStr}T${punch_time}:00`);
      }
    } else {
      punchDateTime = new Date();
      punchDateStr = punchDateTime.toISOString().split('T')[0];
    }
    const today = punchDateStr;
    const now = punchDateTime;

    const [existingRows] = await pool.query<any[]>('SELECT * FROM attendance_records WHERE emp_id = ? AND date = ?', [emp.id, today]);
    const existing = existingRows[0];

    let targetAction = action;
    if (action === 'auto') {
      if (existing?.punch_in && !existing?.punch_out) {
        // Second time punch -> automatically punch out
        targetAction = 'out';
      } else if (!existing?.punch_in) {
        targetAction = 'in';
      } else if (existing?.punch_in && existing?.punch_out) {
        return res.status(409).json({
          success: false,
          message: 'Already completed both Punch In and Punch Out for today',
          data: existing
        });
      }
    }

    if (targetAction === 'in') {
      if (existing?.punch_in) {
        return res.status(409).json({ success: false, message: 'Already punched in today', data: existing });
      }

      const [schedRows] = await pool.query<any[]>('SELECT * FROM work_schedules WHERE is_default = 1 LIMIT 1');
      const sched = schedRows[0];
      let isLate = 0;
      let lateMinutes = 0;

      if (sched) {
        const [h, m] = sched.work_start.split(':').map(Number);
        const schedStart = new Date(now);
        schedStart.setHours(h, m + sched.late_threshold_minutes, 0, 0);
        if (now > schedStart) {
          isLate = 1;
          lateMinutes = Math.floor((now.getTime() - schedStart.getTime()) / 60000);
        }
      }

      if (existing) {
        await pool.query('UPDATE attendance_records SET punch_in = ?, is_late = ?, late_minutes = ?, status = ?, punched_by = ? WHERE id = ?',
          [now, isLate, lateMinutes, isLate ? 'late' : 'present', req.user!.id, existing.id]);
      } else {
        await pool.query('INSERT INTO attendance_records (emp_id, date, punch_in, is_late, late_minutes, status, punched_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [emp.id, today, now, isLate, lateMinutes, isLate ? 'late' : 'present', req.user!.id]);
      }

      // Record in audit log so it shows in Recent System Activity on Dashboard
      try {
        await auditLog(
          req.user?.id || null,
          req.user?.username || 'terminal',
          'punch_in',
          'attendance',
          emp.id,
          `${emp.name} (${emp.emp_code})`,
          { action: 'in', time: now, is_late: isLate, late_minutes: lateMinutes },
          `Punch In: ${emp.name} (${emp.emp_code})${isLate ? ' - Late ' + lateMinutes + 'm' : ''}`,
          req
        );
      } catch (logErr) {
        console.error('Audit log error on punch in:', logErr);
      }

      return res.json({
        success: true,
        action: 'in',
        message: `Punch In recorded${isLate ? ' (Late ' + lateMinutes + 'm)' : ''}`,
        emp_name: emp.name,
        time: now,
        is_late: isLate === 1,
        late_minutes: lateMinutes
      });
    } else if (targetAction === 'out') {
      if (!existing?.punch_in) {
        return res.status(400).json({ success: false, message: 'No punch-in found today for this employee' });
      }
      if (existing.punch_out) {
        return res.status(409).json({ success: false, message: 'Already punched out today' });
      }

      let overtimeHours = 0;
      const [schedRows] = await pool.query<any[]>('SELECT * FROM work_schedules WHERE is_default = 1 LIMIT 1');
      const sched = schedRows[0];
      if (sched) {
        const [h, m] = sched.work_end.split(':').map(Number);
        const schedEnd = new Date(now);
        schedEnd.setHours(h, m, 0, 0);
        if (now > schedEnd) overtimeHours = parseFloat(((now.getTime() - schedEnd.getTime()) / 3600000).toFixed(2));
      }

      await pool.query('UPDATE attendance_records SET punch_out = ?, overtime_hours = ?, punched_by = ? WHERE id = ?',
        [now, overtimeHours, req.user!.id, existing.id]);

      // Record in audit log so it shows in Recent System Activity on Dashboard
      try {
        await auditLog(
          req.user?.id || null,
          req.user?.username || 'terminal',
          'punch_out',
          'attendance',
          emp.id,
          `${emp.name} (${emp.emp_code})`,
          { action: 'out', time: now, overtime_hours: overtimeHours },
          `Punch Out: ${emp.name} (${emp.emp_code})${overtimeHours > 0 ? ' - OT ' + overtimeHours + 'h' : ''}`,
          req
        );
      } catch (logErr) {
        console.error('Audit log error on punch out:', logErr);
      }

      return res.json({
        success: true,
        action: 'out',
        message: `Punch Out recorded${overtimeHours > 0 ? ' (OT: ' + overtimeHours + 'h)' : ''}`,
        emp_name: emp.name,
        time: now,
        overtime_hours: overtimeHours
      });
    }
    return res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/today
router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<any[]>(
      `SELECT ar.*, e.name, e.name as emp_name, e.emp_code, d.name as department_name, d.name as dept_name 
       FROM attendance_records ar
       JOIN employees e ON ar.emp_id = e.id 
       LEFT JOIN departments d ON (e.department_id = d.id OR e.dept_id = d.id)
       WHERE (ar.date = CURDATE() OR ar.date = ?) AND ar.is_archived = 0 
       ORDER BY ar.punch_in DESC, ar.id DESC`, [today]
    );

    // Also get active employee total to give a quick overview
    const [empSummary] = await pool.query<any[]>(
      `SELECT COUNT(*) as active_count FROM employees WHERE status = 'active'`
    );

    return res.json({ 
      success: true, 
      data: rows,
      meta: {
        today,
        total_active_employees: empSummary[0]?.active_count || 0,
        punched_count: rows.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/attendance/monthly
router.get('/monthly', async (req: Request, res: Response) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT ar.*, e.name as emp_name, e.emp_code, d.name as dept_name, d.name as department_name
       FROM attendance_records ar JOIN employees e ON ar.emp_id = e.id
       LEFT JOIN departments d ON (e.department_id = d.id OR e.dept_id = d.id)
       WHERE MONTH(ar.date) = ? AND YEAR(ar.date) = ? AND ar.is_archived = 0
       ORDER BY ar.date DESC, e.emp_code ASC`, [month, year]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/attendance/correction/:id
router.put('/correction/:id', authorizeRoles('admin', 'hr'), async (req: Request, res: Response) => {
  const { status, reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Reason required for correction' });
  try {
    await pool.query(
      `UPDATE attendance_records SET status=?, is_corrected=1, correction_reason=?, corrected_by=?, corrected_at=NOW() WHERE id=?`,
      [status || 'present', reason, req.user!.id, req.params.id]
    );
    await auditLog(req.user!.id, req.user!.username, 'edit', 'attendance', parseInt(req.params.id), null, req.body, reason, req);
    return res.json({ success: true, message: 'Attendance corrected' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/attendance/mark-absent
router.post('/mark-absent', authorizeRoles('admin', 'hr'), async (req: Request, res: Response) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ success: false, message: 'date required' });
  try {
    const [emps] = await pool.query<any[]>(
      `SELECT e.id FROM employees e WHERE e.status = 'active'
       AND e.id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ?)`, [date]
    );
    for (const emp of emps) {
      await pool.query('INSERT IGNORE INTO attendance_records (emp_id, date, status, punched_by) VALUES (?, ?, "absent", ?)',
        [emp.id, date, req.user!.id]);
    }
    return res.json({ success: true, count: emps.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
