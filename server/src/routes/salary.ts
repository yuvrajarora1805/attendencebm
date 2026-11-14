import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';

const router = Router();
router.use(authenticate);

// ── Salary Formula ──────────────────────────────────────────
function calculateSalary(data: any): { 
  leaves_amount: number; 
  advance_cf: number; 
  net_salary: number; 
  gross_amount: number;
  allowed_leaves_bonus: number;
} {
  const basic = Number(data.basic_salary) || 0;
  const perDay = Number(data.salary_per_day) || 0;
  const leaves = Number(data.final_leaves) || 0;
  const opBal = Number(data.op_balance) || 0;
  const advGiven = Number(data.advance_given) || 0;
  const advDed = Number(data.advance_deduction) || 0;
  const otherDed = Number(data.other_deduction) || 0;
  let otherInc = Number(data.other_incentives) || 0;
  const allowedLeavesBonus = Number(data.allowed_leaves_bonus) || 0;

  // Add allowed leaves encashment bonus to incentives if provided
  otherInc += allowedLeavesBonus;

  const leaves_amount = parseFloat((perDay * leaves).toFixed(2));
  const advance_cf = parseFloat((opBal + advGiven - advDed).toFixed(2));
  const net_salary = parseFloat((basic - leaves_amount - otherDed + otherInc).toFixed(2));
  const gross_amount = parseFloat((net_salary - advDed).toFixed(2));
  return { leaves_amount, advance_cf, net_salary, gross_amount, allowed_leaves_bonus: allowedLeavesBonus };
}

// GET /api/salary/periods
router.get('/periods', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver', 'manager'), async (req: Request, res: Response) => {
  try {
    const isManager = req.user?.role === 'manager';
    let query = `
      SELECT sp.*, u.full_name as finalized_by_name
      FROM salary_periods sp
      LEFT JOIN users u ON sp.finalized_by = u.id
    `;
    if (isManager) {
      // Managers only see periods that have been officially released by Admin
      query += ` WHERE sp.is_released = 1`;
    }
    query += ` ORDER BY sp.year DESC, sp.month DESC`;

    const [rows] = await pool.query<any[]>(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/salary/periods - Create period
router.post('/periods', authorizeRoles('admin', 'payroll_operator'), async (req: Request, res: Response) => {
  const { month, year, notes } = req.body;
  if (!month || !year) { res.status(400).json({ success: false, message: 'month and year required' }); return; }
  try {
    const [result] = await pool.query<any>(
      'INSERT INTO salary_periods (month, year, notes) VALUES (?, ?, ?)',
      [month, year, notes || null]
    );
    res.status(201).json({ success: true, id: result.insertId, message: 'Salary period created' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') { res.status(409).json({ success: false, message: 'Period already exists' }); return; }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/salary/periods/:id/entries - All salary entries for a period (Manager Privacy Protected)
router.get('/periods/:id/entries', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver', 'manager'), async (req: Request, res: Response) => {
  try {
    const { search, paid, status = 'active' } = req.query;
    const isManager = req.user?.role === 'manager';
    const canViewRawSalaries = ['admin', 'hr', 'payroll_operator', 'payroll_approver'].includes(req.user?.role || '');

    const [periodRows] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!periodRows.length) return res.status(404).json({ success: false, message: 'Period not found' });
    const period = periodRows[0];
    const isReleased = Boolean(period.is_released);

    // If requester is a Manager and sheet has not been released by Admin, block access
    if (isManager && !isReleased) {
      return res.status(403).json({
        success: false,
        message: 'This salary sheet has not been released by Admin yet. It will become visible once Admin releases it.'
      });
    }

    let query = `
      SELECT se.*, e.emp_code, e.name as emp_name, e.name, e.job_role, e.status as employee_status,
             d.name as department_name, d.name as dept_name,
             (CASE WHEN e.joining_date IS NOT NULL AND e.joining_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) THEN 1 ELSE 0 END) as is_new_joining
      FROM salary_entries se
      JOIN employees e ON se.emp_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE se.period_id = ?`;
    const params: any[] = [req.params.id];

    // Filter by employee active status: by default only active employees are shown in the salary sheet
    const empStatus = String(status || 'active').toLowerCase();
    if (empStatus === 'active') {
      query += ` AND e.status = 'active'`;
    } else if (empStatus === 'inactive') {
      query += ` AND e.status = 'inactive'`;
    } // if 'all', include both active and inactive

    if (search) { query += ' AND (e.name LIKE ? OR e.emp_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (paid !== undefined) { query += ' AND se.paid = ?'; params.push(paid === 'true' ? 1 : 0); }
    query += ' ORDER BY e.name ASC';

    const [rows] = await pool.query<any[]>(query, params);

    // If requester is not authorized for raw payroll figures, mask individual financial values
    const processedRows = rows.map(r => {
      if (!canViewRawSalaries) {
        return {
          ...r,
          basic_salary: 'Confidential',
          salary_per_day: 'Confidential',
          leaves_amount: 'Confidential',
          net_salary: 'Confidential',
          gross_amount: 'Confidential',
          advance_cf: 'Confidential',
          _is_masked_for_manager: true
        };
      }
      return r;
    });

    res.json({ success: true, data: processedRows, period_status: period.status, is_released: isReleased });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/salary/periods/:id/generate - Auto-generate entries from attendance
router.post('/periods/:id/generate', authorizeRoles('admin', 'payroll_operator'), async (req: Request, res: Response) => {
  try {
    const [period] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!period.length) { res.status(404).json({ success: false, message: 'Period not found' }); return; }
    if (period[0].is_locked) { res.status(400).json({ success: false, message: 'Period is locked' }); return; }

    const { month, year } = period[0];

    // Clean up any stale salary entries for employees who have been deactivated
    await pool.query(
      `DELETE se FROM salary_entries se
       JOIN employees e ON se.emp_id = e.id
       WHERE se.period_id = ? AND e.status = 'inactive'`,
      [req.params.id]
    );

    const [employees] = await pool.query<any[]>('SELECT * FROM employees WHERE status = "active"');
    let created = 0;

    for (const emp of employees) {
      // Get attendance summary
      const [attSummary] = await pool.query<any[]>(
        `SELECT 
          COUNT(*) as total_records,
          COALESCE(SUM(CASE WHEN status IN ('present','late') THEN 1 WHEN status='half_day' THEN 0.5 ELSE 0 END), 0) as present_days,
          COALESCE(SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END), 0) as absent_days,
          COALESCE(SUM(CASE WHEN status='leave' THEN 1 ELSE 0 END), 0) as leave_days
         FROM attendance_records WHERE emp_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0`,
        [emp.id, month, year]
      );

      // 1. Calculate unrecovered advance debt from advance_transactions:
      // Includes all given advances minus all other deductions (excluding any deductions from this period if recalculating)
      const [advDebtRows]: any = await pool.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as total_given,
           COALESCE(SUM(CASE WHEN type = 'deduction' AND (period_id IS NULL OR period_id != ?) THEN amount ELSE 0 END), 0) as total_deducted
         FROM advance_transactions 
         WHERE emp_id = ?`,
        [req.params.id, emp.id]
      );
      const totalUnrecoveredDebt = Math.max(0, parseFloat(advDebtRows[0]?.total_given || 0) - parseFloat(advDebtRows[0]?.total_deducted || 0));

      // 2. Also check if there's advance C/F from previous salary period
      const [lastEntry] = await pool.query<any[]>(
        `SELECT se.advance_cf FROM salary_entries se
         JOIN salary_periods sp ON se.period_id = sp.id
         WHERE se.emp_id = ?
         AND (sp.year < ? OR (sp.year = ? AND sp.month < ?))
         ORDER BY sp.year DESC, sp.month DESC LIMIT 1`,
        [emp.id, year, year, month]
      );
      const prevPeriodCf = parseFloat(lastEntry[0]?.advance_cf || 0);

      // The total advance balance to be settled/carried forward
      let totalOutstandingAdvance = Math.max(totalUnrecoveredDebt, prevPeriodCf);

      // Check if advances were given specifically in this calendar month
      const [advGivenThisMonth] = await pool.query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM advance_transactions 
         WHERE emp_id = ? AND type='given' AND MONTH(date) = ? AND YEAR(date) = ?`,
        [emp.id, month, year]
      );
      const periodAdvGiven = parseFloat(advGivenThisMonth[0]?.total || 0);

      let op_balance = 0;
      let advance_given = 0;
      if (periodAdvGiven > 0) {
        advance_given = Math.min(periodAdvGiven, totalOutstandingAdvance);
        op_balance = parseFloat((totalOutstandingAdvance - advance_given).toFixed(2));
      } else {
        op_balance = totalOutstandingAdvance;
        advance_given = 0;
      }

      const summary = attSummary[0];
      const actual_leaves = parseFloat(summary.absent_days) + parseFloat(summary.leave_days);
      const perDay = Number(emp.salary_per_day) || parseFloat((Number(emp.basic_salary || 0) / 30).toFixed(2));

      // Allowed leaves calculation:
      // Uses employee's configured monthly_leave_quota (defaults to 2.0 if not set)
      const allowedLeavesQuota = emp.monthly_leave_quota !== null && emp.monthly_leave_quota !== undefined 
        ? Number(emp.monthly_leave_quota) 
        : 2.0;
      let final_leaves = 0;
      let unusedAllowedBonus = 0;
      let incRemarks = '';
      let dedRemarks = '';

      if (actual_leaves <= allowedLeavesQuota) {
        // Did not exceed allowed leaves: no penalty deduction
        final_leaves = 0;
        const unusedDays = allowedLeavesQuota - actual_leaves;
        if (unusedDays > 0) {
          // Extra attendance incentive bonus for unused allowed leaves
          unusedAllowedBonus = parseFloat((unusedDays * perDay).toFixed(2));
          incRemarks = `Leave Encashment: ${unusedDays} unused allowed day(s) @ ₹${perDay}/d`;
        }
      } else {
        // Exceeded allowed leaves: charge only the extra leaves
        final_leaves = parseFloat((actual_leaves - allowedLeavesQuota).toFixed(2));
        dedRemarks = `Leave Penalty: ${final_leaves} unexcused absence day(s) exceeding ${allowedLeavesQuota}d allowed`;
      }

      // Fetch all active advance cycles (multi-cycle tracking e.g. 1000/mo and 2500/mo)
      const [activeCycles]: any = await pool.query(
        `SELECT id, amount, COALESCE(monthly_deduction, 0) as monthly_deduction, 
                COALESCE(recovered_amount, 0) as recovered_amount,
                (amount - COALESCE(recovered_amount, 0)) as remaining_balance,
                remarks
         FROM advance_transactions
         WHERE emp_id = ? AND type = 'given' 
           AND (amount - COALESCE(recovered_amount, 0)) > 0
           AND remarks NOT LIKE 'SALARY PAID%'
           AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'
         ORDER BY date ASC, id ASC`,
        [emp.id]
      );

      let cycleDebtSum = activeCycles.reduce((sum: number, c: any) => sum + Number(c.remaining_balance || 0), 0);
      if (cycleDebtSum > 0) {
        totalOutstandingAdvance = cycleDebtSum;
      }

      // Calculate structured advance recovery deduction across active cycles
      let plannedAdvanceDed = 0;
      const monthlyDeductionCap = Number(emp.monthly_advance_deduction) || 0;
      const earnedWagesBeforeAdv = Math.max(0, Number(emp.basic_salary || 0) - (perDay * final_leaves) + unusedAllowedBonus);
      let wageRemaining = earnedWagesBeforeAdv;
      let cycleDedDetails: string[] = [];

      if (totalOutstandingAdvance > 0 && wageRemaining > 0) {
        if (activeCycles.length > 0) {
          // Multi-cycle deduction: apply each cycle's configured term
          for (let i = 0; i < activeCycles.length; i++) {
            if (wageRemaining <= 0) break;
            const cycle = activeCycles[i];
            const cycleBal = Number(cycle.remaining_balance);
            const cycleTerm = Number(cycle.monthly_deduction);

            let cycleCut = 0;
            if (cycleTerm > 0) {
              cycleCut = Math.min(cycleTerm, cycleBal, wageRemaining);
            } else {
              // Standard full deduction for this cycle
              cycleCut = Math.min(cycleBal, wageRemaining);
            }

            if (cycleCut > 0) {
              plannedAdvanceDed += cycleCut;
              wageRemaining = Math.max(0, wageRemaining - cycleCut);
              const remainingAfterCut = parseFloat((cycleBal - cycleCut).toFixed(2));
              cycleDedDetails.push(`Cycle ${i + 1} [Adv #${cycle.id}]: ₹${cycleCut}/mo [bal: ₹${remainingAfterCut}]`);
            }
          }
        } else {
          // Flat fallback
          if (monthlyDeductionCap > 0) {
            plannedAdvanceDed = Math.min(monthlyDeductionCap, totalOutstandingAdvance, wageRemaining);
          } else {
            plannedAdvanceDed = Math.min(totalOutstandingAdvance, wageRemaining);
          }
        }

        const remainingDebtAfter = parseFloat((totalOutstandingAdvance - plannedAdvanceDed).toFixed(2));
        if (cycleDedDetails.length > 0) {
          const advNote = `Advance Deductions: ₹${plannedAdvanceDed} (${cycleDedDetails.join(' • ')})`;
          dedRemarks = dedRemarks ? `${dedRemarks} • ${advNote}` : advNote;
        } else {
          const advNote = `Advance Cut: ₹${plannedAdvanceDed}${remainingDebtAfter > 0 ? ` (₹${remainingDebtAfter} balance C/F)` : ' (Cleared)'}`;
          dedRemarks = dedRemarks ? `${dedRemarks} • ${advNote}` : advNote;
        }
      }

      const calc = calculateSalary({
        basic_salary: emp.basic_salary,
        salary_per_day: emp.salary_per_day,
        final_leaves,
        op_balance,
        advance_given,
        advance_deduction: plannedAdvanceDed,
        other_deduction: 0,
        other_incentives: 0,
        allowed_leaves_bonus: unusedAllowedBonus,
      });

      const snapshot = JSON.stringify({ 
        emp, 
        summary, 
        op_balance, 
        advance_given, 
        monthly_advance_deduction: monthlyDeductionCap,
        total_outstanding_advance: totalOutstandingAdvance,
        cycle_deductions: cycleDedDetails,
        allowed_leaves_quota: allowedLeavesQuota,
        unused_allowed_bonus: unusedAllowedBonus
      });

      await pool.query(
        `INSERT INTO salary_entries (
          period_id, emp_id, basic_salary, salary_per_day, working_days, present_days, 
          actual_leaves, final_leaves, leaves_amount, op_balance, advance_given, 
          advance_deduction, advance_cf, net_salary, other_deduction, other_incentives, 
          gross_amount, snapshot_json, calculated_by, calculated_at,
          incentive_remarks, deduction_remarks, allowed_leaves_credit, allowed_leaves_bonus
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           present_days=VALUES(present_days), actual_leaves=VALUES(actual_leaves), final_leaves=VALUES(final_leaves),
           leaves_amount=VALUES(leaves_amount), op_balance=VALUES(op_balance), advance_given=VALUES(advance_given),
           advance_deduction=VALUES(advance_deduction), advance_cf=VALUES(advance_cf), net_salary=VALUES(net_salary), 
           other_incentives=VALUES(other_incentives), gross_amount=VALUES(gross_amount),
           snapshot_json=VALUES(snapshot_json), calculated_by=VALUES(calculated_by), calculated_at=NOW(),
           incentive_remarks=VALUES(incentive_remarks), deduction_remarks=VALUES(deduction_remarks),
           allowed_leaves_credit=VALUES(allowed_leaves_credit), allowed_leaves_bonus=VALUES(allowed_leaves_bonus)`,
        [req.params.id, emp.id, emp.basic_salary, emp.salary_per_day, 26, parseFloat(summary.present_days),
         actual_leaves, final_leaves, calc.leaves_amount, op_balance, advance_given, plannedAdvanceDed,
         calc.advance_cf, calc.net_salary, unusedAllowedBonus, calc.gross_amount, snapshot, req.user!.id,
         incRemarks || null, dedRemarks || null, allowedLeavesQuota, unusedAllowedBonus]
      );
      created++;
    }

    // Update period totals based on active workforce
    const [totals] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_employees, COALESCE(SUM(se.gross_amount), 0) as total_payable 
       FROM salary_entries se 
       JOIN employees e ON se.emp_id = e.id 
       WHERE se.period_id = ? AND e.status = 'active'`, 
      [req.params.id]
    );
    await pool.query(
      'UPDATE salary_periods SET total_employees = ?, total_payable = ? WHERE id = ?',
      [totals[0].total_employees, totals[0].total_payable, req.params.id]
    );

    await auditLog(req.user!.id, req.user!.username, 'create', 'salary', parseInt(req.params.id), `Period:${month}/${year}`, { employees_processed: created }, null, req);
    res.json({ success: true, message: `Generated salary entries for ${created} active employees` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/salary/entries/:id - Update individual salary entry
router.put('/entries/:id', authorizeRoles('admin', 'payroll_operator'), async (req: Request, res: Response) => {
  const d = req.body;
  try {
    // Check if period is locked
    const [entry] = await pool.query<any[]>('SELECT se.*, sp.is_locked FROM salary_entries se JOIN salary_periods sp ON se.period_id = sp.id WHERE se.id = ?', [req.params.id]);
    if (!entry.length) { res.status(404).json({ success: false, message: 'Entry not found' }); return; }
    if (entry[0].is_locked && req.user!.role !== 'admin') { res.status(403).json({ success: false, message: 'Period is locked. Admin required.' }); return; }

    const basic = Number(d.basic_salary) || 0;
    const perDay = Number(d.salary_per_day) || parseFloat((basic / 30).toFixed(2));
    const calc = calculateSalary({
      basic_salary: basic,
      salary_per_day: perDay,
      final_leaves: d.final_leaves,
      op_balance: d.op_balance,
      advance_given: d.advance_given,
      advance_deduction: d.advance_deduction,
      other_deduction: d.other_deduction,
      other_incentives: d.other_incentives,
    });

    await pool.query(
      `UPDATE salary_entries SET basic_salary=?, salary_per_day=?, actual_leaves=?, final_leaves=?, leaves_amount=?,
       op_balance=?, advance_given=?, advance_deduction=?, advance_cf=?, net_salary=?, other_deduction=?, other_incentives=?,
       gross_amount=?, dop=?, remarks=?, paid=?, payment_mode=? WHERE id=?`,
      [d.basic_salary, perDay, d.actual_leaves||0, d.final_leaves||0, calc.leaves_amount,
       d.op_balance||0, d.advance_given||0, d.advance_deduction||0, calc.advance_cf, calc.net_salary,
       d.other_deduction||0, d.other_incentives||0, calc.gross_amount, d.dop||null, d.remarks||null,
       d.paid ? 1 : 0, d.payment_mode||null, req.params.id]
    );

    await auditLog(req.user!.id, req.user!.username, 'edit', 'salary', parseInt(req.params.id), null, d, null, req);
    res.json({ success: true, message: 'Salary entry updated', calculated: calc });
  } catch (err: any) {
    console.error('Salary entry update error:', err);
    res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
});

// POST /api/salary/periods/:id/finalize
router.post('/periods/:id/finalize', authorizeRoles('admin', 'payroll_approver'), async (req: Request, res: Response) => {
  try {
    const [period] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!period.length) { res.status(404).json({ success: false, message: 'Period not found' }); return; }
    if (period[0].is_locked) { res.status(400).json({ success: false, message: 'Already finalized' }); return; }

    const [totals] = await pool.query<any[]>(
      `SELECT COUNT(*) as total_employees, COALESCE(SUM(se.gross_amount), 0) as total_payable 
       FROM salary_entries se
       JOIN employees e ON se.emp_id = e.id
       WHERE se.period_id = ? AND e.status = 'active'`,
      [req.params.id]
    );
    await pool.query(
      'UPDATE salary_periods SET status="finalized", is_locked=1, finalized_by=?, finalized_at=NOW(), total_employees=?, total_payable=? WHERE id=?',
      [req.user!.id, totals[0].total_employees, totals[0].total_payable, req.params.id]
    );

    // Automatically record finalized salary advance deductions into advance_transactions
    const periodMonth = period[0].month;
    const periodYear = period[0].year;
    const lastDayOfMonth = new Date(periodYear, periodMonth, 0).toISOString().split('T')[0];

    const [advEntries] = await pool.query<any[]>(
      `SELECT se.emp_id, se.advance_deduction 
       FROM salary_entries se
       WHERE se.period_id = ? AND se.advance_deduction > 0`,
      [req.params.id]
    );

    // Clean up any previous entries for this period to remain idempotent
    await pool.query(
      `DELETE FROM advance_transactions WHERE period_id = ? AND source_flag = 'SALARY'`,
      [req.params.id]
    );

    for (const entry of advEntries) {
      const deductionAmt = Number(entry.advance_deduction);

      await pool.query(
        `INSERT INTO advance_transactions (emp_id, date, type, amount, period_id, source_flag, mode, remarks, created_by)
         VALUES (?, ?, 'deduction', ?, ?, 'SALARY', 'cash', ?, ?)`,
        [
          entry.emp_id,
          lastDayOfMonth,
          deductionAmt,
          req.params.id,
          `Automated Salary Deduction (${periodMonth}/${periodYear} Payroll)`,
          req.user!.id
        ]
      );

      // Distribute deduction across active advance cycles and update cycle balances
      const [cycles]: any = await pool.query(
        `SELECT id, amount, COALESCE(recovered_amount, 0) as recovered_amount,
                (amount - COALESCE(recovered_amount, 0)) as remaining_balance
         FROM advance_transactions
         WHERE emp_id = ? AND type = 'given' 
           AND (amount - COALESCE(recovered_amount, 0)) > 0
           AND remarks NOT LIKE 'SALARY PAID%'
           AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'
         ORDER BY date ASC, id ASC`,
        [entry.emp_id]
      );

      let remDed = deductionAmt;
      for (const c of cycles) {
        if (remDed <= 0) break;
        const curBal = Number(c.remaining_balance);
        const applyAmt = Math.min(remDed, curBal);
        const newRecovered = parseFloat((Number(c.recovered_amount) + applyAmt).toFixed(2));
        const isClosed = newRecovered >= Number(c.amount);

        await pool.query(
          `UPDATE advance_transactions 
           SET recovered_amount = ?, status = ?
           WHERE id = ?`,
          [newRecovered, isClosed ? 'completed' : 'active', c.id]
        );
        remDed = parseFloat((remDed - applyAmt).toFixed(2));
      }
    }

    await auditLog(req.user!.id, req.user!.username, 'finalize', 'salary', parseInt(req.params.id), `Period:${period[0].month}/${period[0].year}`, null, `Finalized salary period & recorded ${advEntries.length} advance deductions`, req);
    res.json({ success: true, message: `Salary period finalized! ${advEntries.length} advance salary deductions recorded into ledger.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/salary/periods/:id/unlock - Admin unlocks a finalized period
router.post('/periods/:id/unlock', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const [period] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!period.length) { res.status(404).json({ success: false, message: 'Period not found' }); return; }
    if (!period[0].is_locked) { res.status(400).json({ success: false, message: 'Period is already unlocked (Draft)' }); return; }

    await pool.query(
      'UPDATE salary_periods SET status="draft", is_locked=0, finalized_by=NULL, finalized_at=NULL WHERE id=?',
      [req.params.id]
    );

    // 1. Fetch deduction entries being rolled back
    const [rolledDeds]: any = await pool.query(
      `SELECT emp_id, amount FROM advance_transactions WHERE period_id = ? AND source_flag = 'SALARY'`,
      [req.params.id]
    );

    // 2. Roll back automated advance deductions when period is returned to draft
    await pool.query(
      `DELETE FROM advance_transactions WHERE period_id = ? AND source_flag = 'SALARY'`,
      [req.params.id]
    );

    // 3. Reset any completed cycles back to active status for affected employees
    for (const d of rolledDeds) {
      await pool.query(
        `UPDATE advance_transactions 
         SET status = 'active'
         WHERE emp_id = ? AND type = 'given' AND status = 'completed'`,
        [d.emp_id]
      );
    }
    await auditLog(
      req.user!.id,
      req.user!.username,
      'unlock',
      'salary',
      parseInt(req.params.id),
      `Period:${period[0].month}/${period[0].year}`,
      { reason: reason || 'Unlocked by admin' },
      reason || 'Period unlocked by admin',
      req
    );
    res.json({ success: true, message: 'Salary period unlocked successfully' });
  } catch (err) {
    console.error('Error unlocking salary period:', err);
    res.status(500).json({ success: false, message: 'Server error unlocking period' });
  }
});

// POST /api/salary/periods/:id/release - Admin releases salary sheet so managers & staff can view it
router.post('/periods/:id/release', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const [period] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!period.length) { res.status(404).json({ success: false, message: 'Period not found' }); return; }

    await pool.query(
      'UPDATE salary_periods SET is_released = 1, released_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    await auditLog(req.user!.id, req.user!.username, 'release', 'salary', parseInt(req.params.id), `Period:${period[0].month}/${period[0].year}`, null, 'Released salary sheet for manager/staff visibility', req);
    res.json({ success: true, message: 'Salary sheet released! Managers can now view salary details.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error releasing salary sheet' });
  }
});

// POST /api/salary/periods/:id/unrelease - Admin retracts salary sheet release
router.post('/periods/:id/unrelease', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const [period] = await pool.query<any[]>('SELECT * FROM salary_periods WHERE id = ?', [req.params.id]);
    if (!period.length) { res.status(404).json({ success: false, message: 'Period not found' }); return; }

    await pool.query(
      'UPDATE salary_periods SET is_released = 0, released_at = NULL WHERE id = ?',
      [req.params.id]
    );
    await auditLog(req.user!.id, req.user!.username, 'unrelease', 'salary', parseInt(req.params.id), `Period:${period[0].month}/${period[0].year}`, null, 'Withdrew salary sheet release from manager/staff visibility', req);
    res.json({ success: true, message: 'Salary sheet unreleased. It is now hidden from managers and staff.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error un-releasing salary sheet' });
  }
});

// GET /api/salary/dashboard-stats
router.get('/dashboard-stats', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [stats] = await pool.query<any[]>(
      `SELECT 
        COALESCE(SUM(se.gross_amount), 0) as total_salary,
        COALESCE(SUM(se.advance_given), 0) as total_advances,
        COALESCE(SUM(CASE WHEN se.paid = 0 THEN se.gross_amount ELSE 0 END), 0) as unpaid_salary,
        COUNT(CASE WHEN se.paid = 1 THEN 1 END) as paid_count,
        COUNT(CASE WHEN se.paid = 0 THEN 1 END) as unpaid_count
       FROM salary_entries se
       JOIN salary_periods sp ON se.period_id = sp.id
       WHERE sp.month = ? AND sp.year = ?`,
      [month, year]
    );
    res.json({ success: true, data: stats[0], month, year });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
