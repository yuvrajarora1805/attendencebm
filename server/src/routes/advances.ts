import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';

const router = Router();
router.use(authenticate);

// GET /api/advances - list transactions
router.get('/', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver', 'viewer', 'manager'), async (req: Request, res: Response) => {
  try {
    const { emp_id, type, source_flag, from, to, status } = req.query;
    let query = `
      SELECT a.*, e.name as emp_name, e.emp_code, e.status as emp_status, e.joining_date,
             (CASE WHEN e.joining_date IS NOT NULL AND e.joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining,
             u.username as created_by_name
      FROM advance_transactions a
      JOIN employees e ON a.emp_id = e.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (emp_id) { query += ' AND a.emp_id = ?'; params.push(emp_id); }
    if (type) { query += ' AND a.type = ?'; params.push(type); }
    if (source_flag) { query += ' AND a.source_flag = ?'; params.push(source_flag); }
    if (status && status !== 'all') { query += ' AND e.status = ?'; params.push(status); }
    if (from) { query += ' AND a.date >= ?'; params.push(from); }
    if (to) { query += ' AND a.date <= ?'; params.push(to); }
    query += ' ORDER BY a.date DESC, a.id DESC LIMIT 500';

    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/advances/summary/:empId - employee balance & 50% eligibility + new joining check
router.get('/summary/:empId', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver', 'manager'), async (req: Request, res: Response) => {
  try {
    const { empId } = req.params;
    const [empRows]: any = await pool.query(
      `SELECT *, 
        (CASE WHEN joining_date IS NOT NULL AND joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining,
        TIMESTAMPDIFF(DAY, joining_date, CURDATE()) as tenure_days
       FROM employees WHERE id = ?`, 
      [empId]
    );
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = empRows[0];

    const [rows]: any = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as total_given,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deducted
       FROM advance_transactions 
       WHERE emp_id = ?
         AND remarks NOT LIKE 'SALARY PAID%'
         AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'`,
      [empId]
    );
    const totalGiven = Number(rows[0]?.total_given || 0);
    const totalDeducted = Number(rows[0]?.total_deducted || 0);
    const balance = Math.max(0, totalGiven - totalDeducted);

    // Calculate days worked this month
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const [attRows]: any = await pool.query(
      `SELECT 
        SUM(CASE 
          WHEN LOWER(TRIM(status)) IN ('present', 'late') THEN 1 
          WHEN LOWER(TRIM(status)) IN ('half-day', 'half_day') THEN 0.5 
          ELSE 0 END) as days_worked
       FROM attendance_records
       WHERE emp_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0`,
      [empId, curMonth, curYear]
    );

    let daysWorked = Number(attRows[0]?.days_worked || 0);

    // If 0, check verified payroll salary entry for current month
    if (daysWorked === 0) {
      const [salRows]: any = await pool.query(
        `SELECT present_days FROM salary_entries se
         JOIN salary_periods sp ON se.period_id = sp.id
         WHERE se.emp_id = ? AND sp.month = ? AND sp.year = ? LIMIT 1`,
        [empId, curMonth, curYear]
      );
      if (salRows.length > 0 && Number(salRows[0]?.present_days) > 0) {
        daysWorked = Number(salRows[0].present_days);
      }
    }

    // Fallback: If company has 0 records in current calendar month (e.g. historical seed data or test environment)
    if (daysWorked === 0) {
      const [coMonthCheck]: any = await pool.query(
        'SELECT COUNT(*) as cnt FROM attendance_records WHERE MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0',
        [curMonth, curYear]
      );
      if (Number(coMonthCheck[0]?.cnt || 0) === 0) {
        const [latestAtt]: any = await pool.query(
          `SELECT 
            SUM(CASE 
              WHEN LOWER(TRIM(status)) IN ('present', 'late') THEN 1 
              WHEN LOWER(TRIM(status)) IN ('half-day', 'half_day') THEN 0.5 
              ELSE 0 END) as days_worked
           FROM attendance_records
           WHERE emp_id = ? AND is_archived = 0
             AND (YEAR(date), MONTH(date)) = (
               SELECT YEAR(date), MONTH(date) 
               FROM attendance_records 
               WHERE is_archived = 0 
               ORDER BY date DESC LIMIT 1
             )`,
          [empId]
        );
        if (latestAtt.length > 0 && Number(latestAtt[0]?.days_worked || 0) > 0) {
          daysWorked = Number(latestAtt[0].days_worked);
        }
      }
    }

    const salaryPerDay = Number(emp.salary_per_day) || (Number(emp.basic_salary || 0) / 30);
    const earnedSoFar = daysWorked * salaryPerDay;
    // 50% advance eligibility rule
    const maxAdvanceAllowed = Math.round(earnedSoFar * 0.50);
    const netAvailableAdvance = Math.max(0, maxAdvanceAllowed - balance);

    const isManager = req.user?.role === 'manager';

    if (isManager) {
      return res.json({
        success: true,
        data: {
          days_worked: daysWorked,
          advance_percentage_rule: 50,
          current_balance: balance,
          is_new_joining: Boolean(emp.is_new_joining),
          tenure_days: emp.tenure_days,
          joining_date: emp.joining_date
        }
      });
    }

    return res.json({
      success: true,
      data: { 
        total_given: totalGiven, 
        total_deducted: totalDeducted, 
        current_balance: balance,
        days_worked: daysWorked,
        salary_per_day: Math.round(salaryPerDay),
        earned_so_far: Math.round(earnedSoFar),
        advance_percentage_rule: 50,
        max_advance_allowed: maxAdvanceAllowed,
        net_available_advance: netAvailableAdvance,
        is_new_joining: Boolean(emp.is_new_joining),
        tenure_days: emp.tenure_days,
        joining_date: emp.joining_date,
        monthly_advance_deduction: Number(emp.monthly_advance_deduction) || 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/advances - create transaction (Supports Admin Extra Advance & Recovery Terms)
router.post('/', authorizeRoles('admin', 'hr', 'payroll_operator'), async (req: Request, res: Response) => {
  try {
    const { emp_id, date, type, amount, remarks, mode, is_extra_advance, monthly_deduction } = req.body;
    if (!emp_id || !date || !type || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const isAdmin = req.user?.role === 'admin';
    const numAmount = parseFloat(amount);

    // If extra advance is flagged or amount exceeds 50% cap, only admin can authorize
    if (is_extra_advance && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only Admin can approve Extra Advance exceeding the 50% limit.' });
    }

    let finalMonthlyCut = monthly_deduction !== undefined ? (parseFloat(monthly_deduction) || 0) : 0;
    // An installment cannot be greater than or equal to the advance amount.
    // E.g. for ₹300 advance, deducting ₹2000/mo is impossible — it fully recovers in the upcoming cycle (0).
    if (finalMonthlyCut >= numAmount) {
      finalMonthlyCut = 0;
    }

    const [result]: any = await pool.query(
      `INSERT INTO advance_transactions (emp_id, date, type, amount, remarks, mode, created_by, monthly_deduction, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [emp_id, date, type, numAmount, remarks || null, mode || 'cash', req.user?.id, finalMonthlyCut]
    );

    // If Admin set a multi-month monthly salary deduction installment term, save it on employee profile
    if (isAdmin && finalMonthlyCut > 0 && finalMonthlyCut < numAmount) {
      await pool.query(
        `UPDATE employees SET monthly_advance_deduction = ? WHERE id = ?`,
        [finalMonthlyCut, emp_id]
      );
    }

    await auditLog(
      req.user?.id || null,
      req.user?.username || null,
      'CREATE',
      'advance',
      result.insertId,
      null,
      req.body,
      `Recorded advance ${type}: Rs. ${numAmount} for emp #${emp_id} (Monthly deduction: ₹${monthly_deduction || 0})`,
      req
    );

    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/advances/:id
router.delete('/:id', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await pool.query('DELETE FROM advance_transactions WHERE id = ?', [id]);

    await auditLog(
      req.user?.id || null,
      req.user?.username || null,
      'DELETE',
      'advance',
      parseInt(id),
      null,
      null,
      reason || 'Deleted advance transaction',
      req
    );

    return res.json({ success: true, message: 'Transaction deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// MANAGER ADVANCE REQUESTS & ADMIN APPROVAL WORKFLOW
// ============================================================

// GET /api/advances/eligibility-list - List all active employees with live days worked, 50% cap & advance debt
router.get('/eligibility-list', authorizeRoles('admin', 'manager', 'hr', 'payroll_operator', 'payroll_approver', 'viewer'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // 1. Fetch active employees
    const [employees]: any = await pool.query(
      `SELECT e.id, e.emp_code, e.name, e.department_id, d.name as department_name, e.job_role,
              e.basic_salary, e.salary_per_day, e.joining_date,
              (CASE WHEN e.joining_date IS NOT NULL AND e.joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining,
              TIMESTAMPDIFF(DAY, e.joining_date, CURDATE()) as tenure_days
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.status = 'active'
       ORDER BY e.emp_code ASC, e.name ASC`
    );

    // 2. Fetch advance balances grouped by employee (excluding legacy Access payroll payment vouchers)
    const [balanceRows]: any = await pool.query(
      `SELECT emp_id,
        COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as total_given,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deducted
       FROM advance_transactions
       WHERE remarks NOT LIKE 'SALARY PAID%'
         AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'
       GROUP BY emp_id`
    );
    const balanceMap = new Map<number, { total_given: number; total_deducted: number; balance: number }>();
    for (const b of balanceRows) {
      const given = Number(b.total_given || 0);
      const deducted = Number(b.total_deducted || 0);
      balanceMap.set(b.emp_id, {
        total_given: given,
        total_deducted: deducted,
        balance: Math.max(0, given - deducted)
      });
    }

    // 3. Fetch live attendance days worked for current month
    const [attRows]: any = await pool.query(
      `SELECT emp_id,
        SUM(CASE 
          WHEN LOWER(TRIM(status)) IN ('present', 'late') THEN 1 
          WHEN LOWER(TRIM(status)) IN ('half-day', 'half_day') THEN 0.5 
          ELSE 0 END) as days_worked
       FROM attendance_records
       WHERE MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0
       GROUP BY emp_id`,
      [curMonth, curYear]
    );
    const daysWorkedMap = new Map<number, number>();
    for (const a of attRows) {
      daysWorkedMap.set(a.emp_id, Number(a.days_worked || 0));
    }

    // Fallback: If 0 days recorded in calendar month across the entire company (e.g. historical data)
    let totalPunchesInMonth = 0;
    for (const d of daysWorkedMap.values()) totalPunchesInMonth += d;
    if (totalPunchesInMonth === 0) {
      const [fallbackAtt]: any = await pool.query(
        `SELECT emp_id,
          SUM(CASE 
            WHEN LOWER(TRIM(status)) IN ('present', 'late') THEN 1 
            WHEN LOWER(TRIM(status)) IN ('half-day', 'half_day') THEN 0.5 
            ELSE 0 END) as days_worked
         FROM attendance_records
         WHERE is_archived = 0
           AND (YEAR(date), MONTH(date)) = (
             SELECT YEAR(date), MONTH(date) 
             FROM attendance_records 
             WHERE is_archived = 0 
             ORDER BY date DESC LIMIT 1
           )
         GROUP BY emp_id`
      );
      for (const a of fallbackAtt) {
        daysWorkedMap.set(a.emp_id, Number(a.days_worked || 0));
      }
    }

    // 4. Fetch pending advance requests
    const [pendingRequests]: any = await pool.query(
      `SELECT emp_id, id as request_id, amount as pending_amount, created_at as request_date
       FROM advance_requests
       WHERE status = 'pending'`
    );
    const pendingMap = new Map<number, any>();
    for (const p of pendingRequests) {
      pendingMap.set(p.emp_id, {
        request_id: p.request_id,
        amount: Number(p.pending_amount),
        date: p.request_date
      });
    }

    // Combine data
    const isManager = req.user?.role === 'manager';
    const result = employees.map((emp: any) => {
      const salPerDay = Number(emp.salary_per_day) || (Number(emp.basic_salary || 0) / 30);
      const daysWorked = daysWorkedMap.get(emp.id) || 0;
      const earnedSoFar = Math.round(daysWorked * salPerDay);
      const maxAdvanceAllowed = Math.round(earnedSoFar * 0.50);
      const balInfo = balanceMap.get(emp.id) || { total_given: 0, total_deducted: 0, balance: 0 };
      const netAvailable = Math.max(0, maxAdvanceAllowed - balInfo.balance);

      return {
        id: emp.id,
        emp_code: emp.emp_code,
        name: emp.name,
        department_id: emp.department_id,
        department_name: emp.department_name || 'Staff',
        job_role: emp.job_role,
        joining_date: emp.joining_date,
        is_new_joining: Boolean(emp.is_new_joining),
        tenure_days: emp.tenure_days,
        tenure_months: Math.max(1, Math.round((emp.tenure_days || 0) / 30)),
        days_worked: daysWorked,
        earned_so_far: isManager ? undefined : earnedSoFar,
        max_advance_allowed: maxAdvanceAllowed,
        current_balance: balInfo.balance,
        total_given: balInfo.total_given,
        total_deducted: balInfo.total_deducted,
        net_available_advance: netAvailable,
        suggested_amount: maxAdvanceAllowed,
        pending_request: pendingMap.get(emp.id) || null
      };
    });

    res.json({
      success: true,
      count: result.length,
      period: { month: curMonth, year: curYear },
      data: result
    });
  } catch (err: any) {
    console.error('Error fetching eligibility list:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/advances/employee/:empId/history - Full advance transaction history for an employee
router.get('/employee/:empId/history', authorizeRoles('admin', 'manager', 'hr', 'payroll_operator', 'payroll_approver', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { empId } = req.params;
    const [empRows]: any = await pool.query(
      `SELECT e.id, e.emp_code, e.name, e.joining_date, d.name as department_name,
        (CASE WHEN e.joining_date IS NOT NULL AND e.joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining,
        TIMESTAMPDIFF(DAY, e.joining_date, CURDATE()) as tenure_days
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ?`,
      [empId]
    );
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });

    const [txRows]: any = await pool.query(
      `SELECT a.*, u.username as created_by_name, u.full_name as created_by_full_name
       FROM advance_transactions a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.emp_id = ?
         AND a.remarks NOT LIKE 'SALARY PAID%'
         AND a.remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'
       ORDER BY a.date DESC, a.id DESC`,
      [empId]
    );

    const [sumRows]: any = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as total_given,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deducted
       FROM advance_transactions 
       WHERE emp_id = ?
         AND remarks NOT LIKE 'SALARY PAID%'
         AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'`,
      [empId]
    );

    const totalGiven = Number(sumRows[0]?.total_given || 0);
    const totalDeducted = Number(sumRows[0]?.total_deducted || 0);
    const balance = Math.max(0, totalGiven - totalDeducted);

    res.json({
      success: true,
      data: {
        employee: empRows[0],
        total_given: totalGiven,
        total_deducted: totalDeducted,
        current_balance: balance,
        transactions: txRows || []
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/advances/request-batch - Manager / Admin batch advance requests
router.post('/request-batch', authorizeRoles('admin', 'manager', 'hr'), async (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Array of advance request items is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let inserted = 0;
    const insertedIds: number[] = [];
    for (const item of items) {
      const empId = Number(item.emp_id);
      const amount = Number(item.amount);
      const mode = item.mode || 'cash';
      const reason = item.reason || 'Manager batch advance request (50% rule)';
      const monthlyDeduction = item.monthly_deduction !== undefined ? (parseFloat(item.monthly_deduction) || 0) : 0;

      if (!empId || isNaN(amount) || amount <= 0) continue;

      const [res]: any = await connection.query(
        `INSERT INTO advance_requests (emp_id, requested_by, amount, reason, mode, monthly_deduction, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [empId, req.user!.id, amount, reason, mode, monthlyDeduction]
      );
      insertedIds.push(res.insertId);
      inserted++;
    }

    await connection.commit();

    await auditLog(
      req.user!.id,
      req.user!.username,
      'request_batch',
      'advance_requests',
      null,
      `Batch Request`,
      { count: inserted, request_ids: insertedIds },
      `Submitted ${inserted} advance requests in batch for Admin approval`,
      req
    );

    res.json({
      success: true,
      count: inserted,
      message: `Successfully submitted ${inserted} advance request(s) to Admin for approval!`
    });
  } catch (err: any) {
    await connection.rollback();
    console.error('Batch advance request error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to submit batch requests' });
  } finally {
    connection.release();
  }
});

// POST /api/advances/request - Manager submits advance request for an employee
router.post('/request', authorizeRoles('admin', 'manager', 'hr'), async (req: Request, res: Response) => {
  try {
    const { emp_id, amount, reason, mode, monthly_deduction } = req.body;
    if (!emp_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Employee and valid positive amount are required' });
    }

    const [empRows]: any = await pool.query('SELECT id, name, emp_code FROM employees WHERE id = ?', [emp_id]);
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const emp = empRows[0];
    const numAmt = parseFloat(amount);
    let finalMonthlyCut = monthly_deduction !== undefined ? (parseFloat(monthly_deduction) || 0) : 0;
    if (finalMonthlyCut >= numAmt) {
      finalMonthlyCut = 0;
    }

    const [result]: any = await pool.query(
      `INSERT INTO advance_requests (emp_id, requested_by, amount, reason, mode, monthly_deduction, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [emp_id, req.user!.id, parseFloat(amount), reason || 'Manager requested advance', mode || 'cash', finalMonthlyCut]
    );

    await auditLog(
      req.user!.id,
      req.user!.username,
      'request',
      'advances',
      result.insertId,
      `Emp:${emp.emp_code} - ${emp.name}`,
      { amount, reason, mode, monthly_deduction: finalMonthlyCut },
      `Manager requested advance of ₹${amount} for ${emp.name} (Monthly deduction: ₹${finalMonthlyCut})`,
      req
    );

    return res.status(201).json({
      success: true,
      message: `Advance request of ₹${Number(amount).toLocaleString()} for ${emp.name} submitted to Admin for approval.`,
      id: result.insertId
    });
  } catch (err: any) {
    console.error('Error submitting advance request:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// GET /api/advances/requests - List advance requests (Managers see theirs / team, Admins see all)
router.get('/requests', authorizeRoles('admin', 'manager', 'hr', 'payroll_operator', 'payroll_approver', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { status, emp_id } = req.query;
    const isManager = req.user?.role === 'manager';

    let query = `
      SELECT ar.*, 
             e.name as emp_name, e.emp_code, e.job_role, e.status as emp_status,
             e.joining_date,
             (CASE WHEN e.joining_date IS NOT NULL AND e.joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining,
             TIMESTAMPDIFF(DAY, e.joining_date, CURDATE()) as tenure_days,
             d.name as department_name,
             u.full_name as requested_by_name, u.username as requested_by_username,
             rev.full_name as reviewed_by_name,
             -- Current month leaves count
             COALESCE((
               SELECT SUM(CASE 
                 WHEN status IN ('leave', 'on-leave', 'on_leave') THEN 1 
                 WHEN status = 'absent' THEN 1 
                 WHEN status IN ('half_day', 'half-day') THEN 0.5 
                 ELSE 0 END)
               FROM attendance_records
               WHERE emp_id = e.id 
                 AND MONTH(date) = MONTH(CURDATE()) 
                 AND YEAR(date) = YEAR(CURDATE()) 
                 AND is_archived = 0
             ), 0) as cur_month_leaves,
             -- Last month leaves count
             COALESCE((
               SELECT final_leaves FROM salary_entries se
               JOIN salary_periods sp ON se.period_id = sp.id
               WHERE se.emp_id = e.id 
                 AND sp.year = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
                 AND sp.month = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
               LIMIT 1
             ), (
               SELECT SUM(CASE 
                 WHEN status IN ('leave', 'on-leave', 'on_leave') THEN 1 
                 WHEN status = 'absent' THEN 1 
                 WHEN status IN ('half_day', 'half-day') THEN 0.5 
                 ELSE 0 END)
               FROM attendance_records
               WHERE emp_id = e.id 
                 AND MONTH(date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
                 AND YEAR(date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
                 AND is_archived = 0
             ), 0) as last_month_leaves,
             -- Current outstanding advance debt
             COALESCE((
               SELECT SUM(CASE WHEN type = 'given' THEN amount ELSE -amount END)
               FROM advance_transactions
               WHERE emp_id = e.id
                 AND remarks NOT LIKE 'SALARY PAID%'
                 AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'
             ), 0) as current_advance_balance
      FROM advance_requests ar
      JOIN employees e ON ar.emp_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON ar.requested_by = u.id
      LEFT JOIN users rev ON ar.reviewed_by = rev.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Allow managers to review all advance requests so they can track Approved and Rejected advances
    if (status && status !== 'all') {
      query += ' AND ar.status = ?';
      params.push(status);
    }
    if (emp_id) {
      query += ' AND ar.emp_id = ?';
      params.push(emp_id);
    }

    query += ' ORDER BY (CASE WHEN ar.status = "pending" THEN 0 ELSE 1 END), ar.id DESC LIMIT 200';

    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('Error fetching advance requests:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// POST /api/advances/requests/bulk-approve - Admin bulk approves multiple pending requests
router.post('/requests/bulk-approve', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { request_ids, default_monthly_deduction, admin_notes } = req.body;
    if (!Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one advance request to approve' });
    }

    const [rows]: any = await pool.query(
      `SELECT ar.*, e.name as emp_name, e.emp_code
       FROM advance_requests ar
       JOIN employees e ON ar.emp_id = e.id
       WHERE ar.id IN (?) AND ar.status = 'pending'`,
      [request_ids]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No pending advance requests found for selected IDs' });
    }

    const finalDate = new Date().toISOString().split('T')[0];
    const deduction = default_monthly_deduction !== undefined ? (parseFloat(default_monthly_deduction) || 0) : 0;
    let approvedCount = 0;
    let totalDisbursed = 0;

    for (const item of rows) {
      const amount = Number(item.amount);
      const mode = item.mode || 'cash';
      const finalMonthlyCut = deduction > 0 ? deduction : (Number(item.monthly_deduction) || 0);

      // 1. Create transaction
      const [txn]: any = await pool.query(
        `INSERT INTO advance_transactions (emp_id, date, type, amount, remarks, mode, created_by, source_flag, monthly_deduction, status)
         VALUES (?, ?, 'given', ?, ?, ?, ?, 'MANAGER_REQ_BULK_APPROVED', ?, 'active')`,
        [
          item.emp_id,
          finalDate,
          amount,
          `Bulk Approved Advance (Req #${item.id}): ${item.reason || 'Staff Advance'}${admin_notes ? ` - ${admin_notes}` : ''}`,
          mode,
          req.user!.id,
          finalMonthlyCut
        ]
      );

      // 2. If recovery installment is set, update employee
      if (finalMonthlyCut > 0) {
        await pool.query(
          'UPDATE employees SET monthly_advance_deduction = ? WHERE id = ?',
          [finalMonthlyCut, item.emp_id]
        );
      }

      // 3. Mark request as approved
      await pool.query(
        `UPDATE advance_requests 
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), 
             admin_notes = ?, monthly_deduction = ?, transaction_id = ?
         WHERE id = ?`,
        [req.user!.id, admin_notes || 'Bulk approved by Admin', finalMonthlyCut, txn.insertId, item.id]
      );

      approvedCount++;
      totalDisbursed += amount;
    }

    await auditLog(
      req.user!.id,
      req.user!.username,
      'bulk_approve',
      'advances',
      null,
      `Count:${approvedCount}`,
      { count: approvedCount, total_disbursed: totalDisbursed, request_ids },
      `Admin bulk approved ${approvedCount} advance requests totaling ₹${totalDisbursed.toLocaleString()}`,
      req
    );

    return res.json({
      success: true,
      message: `Successfully approved and disbursed ${approvedCount} advance requests totaling ₹${totalDisbursed.toLocaleString()}!`,
      approved_count: approvedCount,
      total_disbursed: totalDisbursed
    });
  } catch (err: any) {
    console.error('Error bulk approving advance requests:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error bulk approving' });
  }
});

// POST /api/advances/requests/:id/approve - Admin approves manager request and disburses advance
router.post('/requests/:id/approve', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { monthly_deduction, admin_notes, amount, mode } = req.body;

    const [reqRows]: any = await pool.query(
      `SELECT ar.*, e.name as emp_name, e.emp_code 
       FROM advance_requests ar 
       JOIN employees e ON ar.emp_id = e.id 
       WHERE ar.id = ?`,
      [id]
    );
    if (!reqRows.length) {
      return res.status(404).json({ success: false, message: 'Advance request not found' });
    }
    const reqItem = reqRows[0];
    if (reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${reqItem.status}` });
    }

    const finalAmount = amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0 
      ? parseFloat(amount) 
      : Number(reqItem.amount);
    const finalMode = mode || reqItem.mode || 'cash';
    const finalDate = new Date().toISOString().split('T')[0];
    let deductionInstallment = monthly_deduction !== undefined ? (parseFloat(monthly_deduction) || 0) : Number(reqItem.monthly_deduction || 0);
    if (deductionInstallment >= finalAmount) {
      deductionInstallment = 0;
    }

    // 1. Create advance transaction
    const [txnRes]: any = await pool.query(
      `INSERT INTO advance_transactions (emp_id, date, type, amount, remarks, mode, created_by, source_flag, monthly_deduction, status)
       VALUES (?, ?, 'given', ?, ?, ?, ?, 'MANAGER_REQ_APPROVED', ?, 'active')`,
      [
        reqItem.emp_id,
        finalDate,
        finalAmount,
        `Approved Advance (Req #${id}): ${reqItem.reason || 'Staff Advance'}${admin_notes ? ` - ${admin_notes}` : ''}`,
        finalMode,
        req.user!.id,
        deductionInstallment
      ]
    );

    // 2. Update employee recovery installment terms if genuine multi-month term
    if (deductionInstallment > 0 && deductionInstallment < finalAmount) {
      await pool.query(
        'UPDATE employees SET monthly_advance_deduction = ? WHERE id = ?',
        [deductionInstallment, reqItem.emp_id]
      );
    }

    // 3. Mark request as approved
    await pool.query(
      `UPDATE advance_requests 
       SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), 
           admin_notes = ?, monthly_deduction = ?, transaction_id = ?
       WHERE id = ?`,
      [req.user!.id, admin_notes || 'Approved by Admin', deductionInstallment, txnRes.insertId, id]
    );

    await auditLog(
      req.user!.id,
      req.user!.username,
      'approve',
      'advances',
      parseInt(id),
      `Emp:${reqItem.emp_code} - ${reqItem.emp_name}`,
      { amount: finalAmount, mode: finalMode, monthly_deduction: deductionInstallment },
      `Admin approved manager advance request of ₹${finalAmount} for ${reqItem.emp_name}`,
      req
    );

    return res.json({
      success: true,
      message: `Advance of ₹${finalAmount.toLocaleString()} approved and disbursed for ${reqItem.emp_name}.`
    });
  } catch (err: any) {
    console.error('Error approving advance request:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error approving advance' });
  }
});

// POST /api/advances/requests/:id/reject - Admin rejects manager request
router.post('/requests/:id/reject', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [reqRows]: any = await pool.query(
      `SELECT ar.*, e.name as emp_name, e.emp_code 
       FROM advance_requests ar 
       JOIN employees e ON ar.emp_id = e.id 
       WHERE ar.id = ?`,
      [id]
    );
    if (!reqRows.length) {
      return res.status(404).json({ success: false, message: 'Advance request not found' });
    }
    const reqItem = reqRows[0];
    if (reqItem.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${reqItem.status}` });
    }

    await pool.query(
      `UPDATE advance_requests 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), admin_notes = ? 
       WHERE id = ?`,
      [req.user!.id, reason || 'Rejected by Admin', id]
    );

    await auditLog(
      req.user!.id,
      req.user!.username,
      'reject',
      'advances',
      parseInt(id),
      `Emp:${reqItem.emp_code} - ${reqItem.emp_name}`,
      { reason },
      `Admin rejected manager advance request for ${reqItem.emp_name}: ${reason || 'No reason provided'}`,
      req
    );

    return res.json({
      success: true,
      message: `Advance request for ${reqItem.emp_name} has been rejected.`
    });
  } catch (err: any) {
    console.error('Error rejecting advance request:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

export default router;
