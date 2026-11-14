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
    const queryDate = (req.query.date as string) || '';
    const today = queryDate || new Date().toISOString().split('T')[0];

    const [rows] = await pool.query<any[]>(
      `SELECT ar.*, e.name, e.name as emp_name, e.emp_code, d.name as department_name, d.name as dept_name 
       FROM attendance_records ar
       JOIN employees e ON ar.emp_id = e.id 
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE ar.date = ? AND ar.is_archived = 0 
       ORDER BY COALESCE(ar.punch_out, ar.punch_in) DESC, ar.id DESC`,
      [today]
    );

    // Get unpunched active employees for today
    const [unpunchedRows] = await pool.query<any[]>(
      `SELECT e.id, e.name, e.name as emp_name, e.emp_code, d.name as department_name, d.name as dept_name 
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.status = 'active'
         AND e.id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ? AND is_archived = 0)
       ORDER BY e.emp_code ASC`,
      [today]
    );

    // Also get active employee total to give a quick overview
    const [empSummary] = await pool.query<any[]>(
      `SELECT COUNT(*) as active_count FROM employees WHERE status = 'active'`
    );

    const activeCount = empSummary[0]?.active_count || (rows.length + unpunchedRows.length);
    const punchedCount = rows.filter(r => r.punch_in != null).length;
    const completedCount = rows.filter(r => r.punch_in != null && r.punch_out != null).length;
    const activeInsideCount = rows.filter(r => r.punch_in != null && !r.punch_out).length;
    const leaveCount = rows.filter(r => r.status === 'leave').length;
    const absentCount = rows.filter(r => r.status === 'absent').length;

    return res.json({ 
      success: true, 
      data: rows,
      unpunched: unpunchedRows,
      meta: {
        today,
        total_active_employees: activeCount,
        punched_count: punchedCount,
        active_inside_count: activeInsideCount,
        completed_count: completedCount,
        leave_count: leaveCount,
        absent_count: absentCount,
        unpunched_count: unpunchedRows.length
      }
    });
  } catch (err: any) {
    console.error('Error fetching today attendance:', err?.message || err);
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
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE MONTH(ar.date) = ? AND YEAR(ar.date) = ? AND ar.is_archived = 0
       ORDER BY ar.date DESC, e.emp_code ASC`, [month, year]
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('Error fetching monthly attendance:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/attendance/correction/:id
router.put('/correction/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
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

// DELETE /api/attendance/record/:id - Manager/Admin reset an absent or leave record
router.delete('/record/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  try {
    const [rec] = await pool.query<any[]>(
      `SELECT ar.*, e.name, e.emp_code FROM attendance_records ar JOIN employees e ON ar.emp_id = e.id WHERE ar.id = ?`,
      [req.params.id]
    );
    if (!rec.length) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await pool.query(`DELETE FROM attendance_records WHERE id = ?`, [req.params.id]);

    await auditLog(
      req.user!.id,
      req.user!.username,
      'delete',
      'attendance',
      parseInt(req.params.id),
      `${rec[0].name} (${rec[0].emp_code})`,
      rec[0],
      `Reset attendance record for ${rec[0].name} on ${rec[0].date}`,
      req
    );

    return res.json({ success: true, message: 'Record removed. Status reset to pending.' });
  } catch (err) {
    console.error('Error deleting attendance record:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/attendance/leave - Grant leave for an employee (Single day or Range)
router.post('/leave', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { emp_id, emp_code, leave_type = 'casual', from_date, to_date, date, reason, is_half_day } = req.body;
  if (!emp_id && !emp_code) {
    return res.status(400).json({ success: false, message: 'emp_id or emp_code is required' });
  }

  const startDate = date || from_date;
  if (!startDate) {
    return res.status(400).json({ success: false, message: 'date is required' });
  }

  const endDate = to_date || startDate;

  const validLeaveTypes = ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'other'];
  const sanitizedType = validLeaveTypes.includes(String(leave_type).toLowerCase()) 
    ? String(leave_type).toLowerCase() 
    : 'casual';

  try {
    const [empRows] = await pool.query<any[]>(
      'SELECT id, name, emp_code FROM employees WHERE (id = ? OR emp_code = ?) AND status = "active" LIMIT 1',
      [emp_id || 0, (emp_code || '').toUpperCase()]
    );
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: 'Active employee not found' });
    }
    const emp = empRows[0];

    // Generate list of dates between from_date and to_date
    const dates: string[] = [];
    const curr = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    if (dates.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const totalDays = is_half_day ? 0.5 : dates.length;
    const leaveStatus = is_half_day ? 'half_day' : 'leave';
    const notes = `[Leave: ${sanitizedType.toUpperCase()}] ${reason || 'Approved leave'}`.trim();

    // 1. Insert into leave_records
    const [leaveRes]: any = await pool.query(
      `INSERT INTO leave_records (emp_id, leave_type, from_date, to_date, total_days, reason, status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
      [emp.id, sanitizedType, startDate, endDate, totalDays, reason || null, req.user!.id]
    );

    // 2. Upsert each date into attendance_records
    for (const d of dates) {
      await pool.query(
        `INSERT INTO attendance_records (emp_id, date, status, notes, punched_by, is_corrected, correction_reason)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE 
           status = VALUES(status),
           notes = VALUES(notes),
           punched_by = VALUES(punched_by),
           is_corrected = 1,
           correction_reason = VALUES(correction_reason)`,
        [emp.id, d, leaveStatus, notes, req.user!.id, notes]
      );
    }

    await auditLog(
      req.user!.id,
      req.user!.username,
      'create',
      'leave',
      leaveRes.insertId,
      `${emp.name} (${emp.emp_code})`,
      { leave_type: sanitizedType, from_date: startDate, to_date: endDate, total_days: totalDays },
      `Leave marked: ${emp.name} (${emp.emp_code}) - ${sanitizedType.toUpperCase()} (${startDate} to ${endDate})`,
      req
    );

    return res.json({
      success: true,
      message: `Leave successfully recorded for ${emp.name} (${totalDays} day${totalDays > 1 ? 's' : ''})`,
      data: {
        emp_id: emp.id,
        emp_code: emp.emp_code,
        emp_name: emp.name,
        leave_type: sanitizedType,
        from_date: startDate,
        to_date: endDate,
        total_days: totalDays
      }
    });
  } catch (err: any) {
    console.error('Error marking leave:', err);
    return res.status(500).json({ success: false, message: 'Server error while marking leave' });
  }
});

// POST /api/attendance/auto-absent & /mark-absent - Automatically mark unpunched active staff as absent
router.post(['/auto-absent', '/mark-absent'], authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { date } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    // 1. First sync any employees who have approved leave in leave_records covering targetDate into attendance_records if not present
    await pool.query(
      `INSERT INTO attendance_records (emp_id, date, status, notes, punched_by)
       SELECT lr.emp_id, ?, 'leave', CONCAT('[Leave: ', lr.leave_type, '] ', COALESCE(lr.reason, '')), ?
       FROM leave_records lr
       JOIN employees e ON lr.emp_id = e.id
       WHERE lr.status = 'approved'
         AND ? BETWEEN lr.from_date AND lr.to_date
         AND e.status = 'active'
         AND lr.emp_id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ? AND is_archived = 0)
       ON DUPLICATE KEY UPDATE status = 'leave'`,
      [targetDate, req.user!.id, targetDate, targetDate]
    );

    // 2. Find all active employees who have NO attendance record at all for targetDate
    const [unpunched] = await pool.query<any[]>(
      `SELECT e.id, e.name, e.emp_code 
       FROM employees e 
       WHERE e.status = 'active'
         AND e.id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ? AND is_archived = 0)`,
      [targetDate]
    );

    if (unpunched.length === 0) {
      return res.json({ 
        success: true, 
        count: 0, 
        message: 'No unpunched active employees found for this date. All records are up to date.' 
      });
    }

    for (const emp of unpunched) {
      await pool.query(
        `INSERT IGNORE INTO attendance_records (emp_id, date, status, punched_by, notes)
         VALUES (?, ?, 'absent', ?, 'Auto-marked absent: Did not punch in')`,
        [emp.id, targetDate, req.user!.id]
      );
    }

    await auditLog(
      req.user!.id,
      req.user!.username,
      'create',
      'attendance',
      0,
      `Bulk Absent (${unpunched.length} staff)`,
      { date: targetDate, count: unpunched.length },
      `Auto-marked ${unpunched.length} unpunched employee(s) as absent for ${targetDate}`,
      req
    );

    return res.json({
      success: true,
      count: unpunched.length,
      message: `Successfully marked ${unpunched.length} unpunched employee(s) as absent for ${targetDate}`
    });
  } catch (err: any) {
    console.error('Error auto-marking absent:', err);
    return res.status(500).json({ success: false, message: 'Server error while marking absent' });
  }
});

export default router;
