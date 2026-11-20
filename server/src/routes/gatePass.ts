import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';
import { getTodayDateIST, parseISTDateTime } from './attendance';

const router = Router();
router.use(authenticate);

// Helper to sync total deductible gate pass minutes into attendance_records
async function syncGatePassDeduction(empId: number, passDate: string): Promise<number> {
  try {
    const [sumRows]: any = await pool.query(
      `SELECT COALESCE(SUM(total_minutes), 0) as total_cut
       FROM gate_passes 
       WHERE emp_id = ? AND date = ? AND is_deductible = 1 AND status IN ('out', 'completed')`,
      [empId, passDate]
    );
    const totalCutMinutes = Number(sumRows[0]?.total_cut) || 0;

    await pool.query(
      `UPDATE attendance_records 
       SET gate_pass_minutes = ? 
       WHERE emp_id = ? AND date = ?`,
      [totalCutMinutes, empId, passDate]
    );
    return totalCutMinutes;
  } catch (err) {
    console.error('Error syncing gate pass deduction:', err);
    return 0;
  }
}

// GET /api/gate-pass/recent - Today's KPI metrics and recent gate pass activity
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const today = (req.query.date as string) || getTodayDateIST();

    // 1. KPI Counts
    const [summaryRows]: any = await pool.query(
      `SELECT 
         COUNT(*) as total_today,
         COUNT(CASE WHEN status = 'out' THEN 1 END) as currently_outside,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
         COUNT(CASE WHEN pass_type = 'official' THEN 1 END) as official_visits,
         COALESCE(SUM(CASE WHEN is_deductible = 1 THEN total_minutes ELSE 0 END), 0) as total_minutes_cut
       FROM gate_passes 
       WHERE date = ? AND status != 'cancelled'`,
      [today]
    );

    const stats = summaryRows[0] || {
      total_today: 0,
      currently_outside: 0,
      completed_count: 0,
      official_visits: 0,
      total_minutes_cut: 0
    };

    // 2. Recent Passes List (Top 12)
    const [recentRows]: any = await pool.query(
      `SELECT gp.*, 
              e.emp_code, e.name as emp_name, e.name, 
              d.name as department_name, d.name as dept_name,
              u_app.full_name as approved_by_name,
              u_out.full_name as guard_out_name,
              u_in.full_name as guard_in_name
       FROM gate_passes gp
       JOIN employees e ON gp.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN users u_app ON gp.approved_by = u_app.id
       LEFT JOIN users u_out ON gp.guard_out_by = u_out.id
       LEFT JOIN users u_in ON gp.guard_in_by = u_in.id
       WHERE gp.date = ?
       ORDER BY 
         CASE WHEN gp.status = 'out' THEN 0 WHEN gp.status = 'approved' THEN 1 ELSE 2 END,
         gp.id DESC
       LIMIT 12`,
      [today]
    );

    return res.json({
      success: true,
      stats: {
        total_today: Number(stats.total_today) || 0,
        currently_outside: Number(stats.currently_outside) || 0,
        completed_count: Number(stats.completed_count) || 0,
        official_visits: Number(stats.official_visits) || 0,
        total_minutes_cut: Number(stats.total_minutes_cut) || 0,
        total_hours_cut: parseFloat(((Number(stats.total_minutes_cut) || 0) / 60).toFixed(2))
      },
      data: recentRows
    });
  } catch (err: any) {
    console.error('Error fetching recent gate passes:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/gate-pass - List all gate passes with filter & pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const { date, status, pass_type, search, emp_id, page = '1', limit = '25' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (date && date !== 'all') {
      whereClause += ' AND gp.date = ?';
      params.push(date);
    }

    if (status && status !== 'all') {
      whereClause += ' AND gp.status = ?';
      params.push(status);
    }

    if (pass_type && pass_type !== 'all') {
      whereClause += ' AND gp.pass_type = ?';
      params.push(pass_type);
    }

    if (emp_id) {
      whereClause += ' AND gp.emp_id = ?';
      params.push(emp_id);
    }

    if (search) {
      whereClause += ' AND (e.name LIKE ? OR e.emp_code LIKE ? OR gp.pass_number LIKE ? OR gp.reason LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Total Count
    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as total 
       FROM gate_passes gp
       JOIN employees e ON gp.emp_id = e.id
       ${whereClause}`,
      params
    );
    const totalRecords = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // Fetch Rows
    const queryParams = [...params, limitNum, offset];
    const [rows]: any = await pool.query(
      `SELECT gp.*, 
              e.emp_code, e.name as emp_name, e.name, 
              d.name as department_name, d.name as dept_name,
              u_app.full_name as approved_by_name,
              u_out.full_name as guard_out_name,
              u_in.full_name as guard_in_name
       FROM gate_passes gp
       JOIN employees e ON gp.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN users u_app ON gp.approved_by = u_app.id
       LEFT JOIN users u_out ON gp.guard_out_by = u_out.id
       LEFT JOIN users u_in ON gp.guard_in_by = u_in.id
       ${whereClause}
       ORDER BY 
         CASE WHEN gp.status = 'out' THEN 0 WHEN gp.status = 'approved' THEN 1 ELSE 2 END,
         gp.date DESC, gp.id DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages
      }
    });
  } catch (err: any) {
    console.error('Error fetching gate passes:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/gate-pass/:id - Fetch single gate pass
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT gp.*, 
              e.emp_code, e.name as emp_name, e.name, 
              d.name as department_name, d.name as dept_name,
              u_app.full_name as approved_by_name,
              u_out.full_name as guard_out_name,
              u_in.full_name as guard_in_name
       FROM gate_passes gp
       JOIN employees e ON gp.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN users u_app ON gp.approved_by = u_app.id
       LEFT JOIN users u_out ON gp.guard_out_by = u_out.id
       LEFT JOIN users u_in ON gp.guard_in_by = u_in.id
       WHERE gp.id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Gate pass not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/gate-pass - Apply / create gate pass
router.post('/', authorizeRoles('admin', 'hr', 'manager', 'security_guard', 'guard'), async (req: Request, res: Response) => {
  const { 
    emp_id, 
    emp_code, 
    date, 
    pass_type = 'personal', 
    reason, 
    expected_out_time, 
    expected_in_time, 
    is_deductible, 
    out_now, 
    notes 
  } = req.body;

  if ((!emp_id && !emp_code) || !reason || !expected_out_time) {
    return res.status(400).json({ success: false, message: 'Employee, Reason, and Expected Out Time are required' });
  }

  try {
    // 1. Resolve employee
    let employee: any;
    if (emp_code) {
      const [empRows]: any = await pool.query('SELECT * FROM employees WHERE emp_code = ?', [String(emp_code).trim().toUpperCase()]);
      if (empRows.length) employee = empRows[0];
    }
    if (!employee && emp_id) {
      const [empRows]: any = await pool.query('SELECT * FROM employees WHERE id = ?', [emp_id]);
      if (empRows.length) employee = empRows[0];
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const passDate = date ? String(date).slice(0, 10) : getTodayDateIST();
    const isDed = is_deductible !== undefined ? (is_deductible ? 1 : 0) : (pass_type === 'official' ? 0 : 1);

    // Generate unique pass number: GP-YYYYMMDD-XXXX
    const cleanDateNumber = passDate.replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const passNumber = `GP-${cleanDateNumber}-${randomSuffix}`;

    const initialStatus = out_now ? 'out' : 'approved';
    const actualOut = out_now ? new Date() : null;
    const guardOutBy = out_now ? req.user!.id : null;

    const [insertResult]: any = await pool.query(
      `INSERT INTO gate_passes 
         (pass_number, emp_id, date, pass_type, reason, expected_out_time, expected_in_time, 
          actual_out_time, is_deductible, status, approved_by, approved_at, guard_out_by, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [
        passNumber,
        employee.id,
        passDate,
        pass_type,
        reason.trim(),
        expected_out_time,
        expected_in_time || null,
        actualOut,
        isDed,
        initialStatus,
        req.user!.id,
        guardOutBy,
        notes || null,
        req.user!.id
      ]
    );

    const gatePassId = insertResult.insertId;

    // Audit log
    await auditLog(
      req.user!.id,
      req.user!.username,
      'create_gate_pass',
      'gate_pass',
      gatePassId,
      `${employee.name} (${employee.emp_code})`,
      { pass_number: passNumber, pass_type, reason, expected_out_time, expected_in_time, is_deductible: isDed, out_now },
      `Created Gate Pass ${passNumber} for ${employee.name} (${employee.emp_code}) - [${pass_type.toUpperCase()}] ${reason}`,
      req
    );

    return res.status(201).json({
      success: true,
      message: `Gate Pass ${passNumber} issued successfully`,
      data: {
        id: gatePassId,
        pass_number: passNumber,
        emp_name: employee.name,
        emp_code: employee.emp_code,
        status: initialStatus
      }
    });
  } catch (err: any) {
    console.error('Error creating gate pass:', err);
    return res.status(500).json({ success: false, message: 'Server error creating gate pass' });
  }
});

// POST /api/gate-pass/:id/out - Guard / Supervisor records gate EXIT
router.post('/:id/out', authorizeRoles('admin', 'hr', 'manager', 'security_guard', 'guard'), async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT gp.*, e.name, e.emp_code FROM gate_passes gp JOIN employees e ON gp.emp_id = e.id WHERE gp.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gate pass not found' });
    const pass = rows[0];

    if (pass.status === 'out') {
      return res.status(400).json({ success: false, message: 'Employee is already marked as OUT' });
    }

    const now = new Date();
    await pool.query(
      `UPDATE gate_passes 
       SET status = 'out', actual_out_time = ?, guard_out_by = ? 
       WHERE id = ?`,
      [now, req.user!.id, pass.id]
    );

    await auditLog(
      req.user!.id,
      req.user!.username,
      'gate_pass_out',
      'gate_pass',
      pass.id,
      `${pass.name} (${pass.emp_code})`,
      { out_time: now },
      `Gate EXIT verified: ${pass.name} (${pass.emp_code}) on Pass ${pass.pass_number}`,
      req
    );

    return res.json({
      success: true,
      message: `Gate EXIT verified for ${pass.name} (${pass.emp_code})`,
      actual_out_time: now
    });
  } catch (err: any) {
    console.error('Error recording gate exit:', err);
    return res.status(500).json({ success: false, message: 'Server error recording gate exit' });
  }
});

// POST /api/gate-pass/:id/in - Guard / Supervisor records RETURN & calculates shift cut
router.post('/:id/in', authorizeRoles('admin', 'hr', 'manager', 'security_guard', 'guard'), async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT gp.*, e.name, e.emp_code FROM gate_passes gp JOIN employees e ON gp.emp_id = e.id WHERE gp.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gate pass not found' });
    const pass = rows[0];

    if (pass.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Gate pass is already completed' });
    }

    const now = new Date();
    let totalMinutes = 0;

    if (pass.actual_out_time) {
      const outTime = new Date(pass.actual_out_time);
      totalMinutes = Math.max(0, Math.round((now.getTime() - outTime.getTime()) / 60000));
    } else {
      // Fallback: calculate using expected out time
      const [h, m] = pass.expected_out_time.split(':').map(Number);
      const outTime = parseISTDateTime(String(pass.date).slice(0, 10), pass.expected_out_time);
      totalMinutes = Math.max(0, Math.round((now.getTime() - outTime.getTime()) / 60000));
    }

    await pool.query(
      `UPDATE gate_passes 
       SET status = 'completed', actual_in_time = ?, total_minutes = ?, guard_in_by = ? 
       WHERE id = ?`,
      [now, totalMinutes, req.user!.id, pass.id]
    );

    // Sync deduction into attendance_records if deductible
    let totalDeductedMinutes = 0;
    if (pass.is_deductible) {
      totalDeductedMinutes = await syncGatePassDeduction(pass.emp_id, String(pass.date).slice(0, 10));
    }

    await auditLog(
      req.user!.id,
      req.user!.username,
      'gate_pass_in',
      'gate_pass',
      pass.id,
      `${pass.name} (${pass.emp_code})`,
      { in_time: now, total_minutes: totalMinutes, is_deductible: pass.is_deductible, totalDeductedMinutes },
      `Gate RETURN verified: ${pass.name} (${pass.emp_code}) - Away: ${totalMinutes}m${pass.is_deductible ? ' (Deducted from shift)' : ' (Official)'}`,
      req
    );

    const hrs = Math.floor(totalMinutes / 60);
    const remM = totalMinutes % 60;

    return res.json({
      success: true,
      message: `Gate RETURN completed. Away time: ${hrs}h ${remM}m (${totalMinutes} mins)${pass.is_deductible ? ' cut from working shift' : ' (Official/Paid)'}`,
      data: {
        total_minutes: totalMinutes,
        duration_text: `${hrs}h ${remM}m`,
        total_deducted_today_minutes: totalDeductedMinutes
      }
    });
  } catch (err: any) {
    console.error('Error recording gate return:', err);
    return res.status(500).json({ success: false, message: 'Server error recording gate return' });
  }
});

// PUT /api/gate-pass/:id - Edit gate pass details
router.put('/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { 
    pass_type, 
    reason, 
    expected_out_time, 
    expected_in_time, 
    is_deductible, 
    status, 
    total_minutes, 
    notes 
  } = req.body;

  try {
    const [rows]: any = await pool.query(
      `SELECT gp.*, e.name, e.emp_code FROM gate_passes gp JOIN employees e ON gp.emp_id = e.id WHERE gp.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gate pass not found' });
    const pass = rows[0];

    const newType = pass_type || pass.pass_type;
    const newReason = reason !== undefined ? reason.trim() : pass.reason;
    const newExpOut = expected_out_time || pass.expected_out_time;
    const newExpIn = expected_in_time !== undefined ? expected_in_time : pass.expected_in_time;
    const newDed = is_deductible !== undefined ? (is_deductible ? 1 : 0) : pass.is_deductible;
    const newStatus = status || pass.status;
    const newMins = total_minutes !== undefined ? parseInt(String(total_minutes), 10) : pass.total_minutes;
    const newNotes = notes !== undefined ? notes : pass.notes;

    await pool.query(
      `UPDATE gate_passes 
       SET pass_type = ?, reason = ?, expected_out_time = ?, expected_in_time = ?, 
           is_deductible = ?, status = ?, total_minutes = ?, notes = ? 
       WHERE id = ?`,
      [newType, newReason, newExpOut, newExpIn, newDed, newStatus, newMins, newNotes, pass.id]
    );

    // Sync deduction into attendance
    await syncGatePassDeduction(pass.emp_id, String(pass.date).slice(0, 10));

    await auditLog(
      req.user!.id,
      req.user!.username,
      'edit_gate_pass',
      'gate_pass',
      pass.id,
      `${pass.name} (${pass.emp_code})`,
      { updated: req.body },
      `Updated Gate Pass ${pass.pass_number} for ${pass.name} (${pass.emp_code})`,
      req
    );

    return res.json({ success: true, message: 'Gate pass updated successfully' });
  } catch (err: any) {
    console.error('Error updating gate pass:', err);
    return res.status(500).json({ success: false, message: 'Server error updating gate pass' });
  }
});

// DELETE /api/gate-pass/:id - Cancel or delete gate pass
router.delete('/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT gp.*, e.name, e.emp_code FROM gate_passes gp JOIN employees e ON gp.emp_id = e.id WHERE gp.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Gate pass not found' });
    const pass = rows[0];

    await pool.query(`DELETE FROM gate_passes WHERE id = ?`, [pass.id]);

    // Resync deduction on attendance record
    await syncGatePassDeduction(pass.emp_id, String(pass.date).slice(0, 10));

    await auditLog(
      req.user!.id,
      req.user!.username,
      'delete_gate_pass',
      'gate_pass',
      pass.id,
      `${pass.name} (${pass.emp_code})`,
      pass,
      `Deleted Gate Pass ${pass.pass_number} for ${pass.name} (${pass.emp_code})`,
      req
    );

    return res.json({ success: true, message: 'Gate pass removed' });
  } catch (err: any) {
    console.error('Error deleting gate pass:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting gate pass' });
  }
});

export default router;
