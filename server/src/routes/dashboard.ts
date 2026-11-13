import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [empStats] = await pool.query<any[]>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status='active' THEN 1 END) as active,
        COUNT(CASE WHEN status='inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status='resigned' THEN 1 END) as resigned
       FROM employees`
    );

    const [attStats] = await pool.query<any[]>(
      `SELECT 
        COUNT(CASE WHEN status IN ('present','late','half-day','half_day') THEN 1 END) as present,
        COUNT(CASE WHEN status='absent' THEN 1 END) as absent,
        COUNT(CASE WHEN status='late' THEN 1 END) as late
       FROM attendance_records WHERE (date = CURDATE() OR date = ?) AND is_archived = 0`,
      [today]
    );

    const [salaryStats] = await pool.query<any[]>(
      `SELECT 
        COALESCE(SUM(se.gross_amount), 0) as total_salary,
        COALESCE(SUM(se.advance_given), 0) as total_advances,
        COALESCE(SUM(CASE WHEN se.paid=0 THEN se.gross_amount ELSE 0 END), 0) as unpaid_salary,
        COUNT(CASE WHEN se.paid=0 THEN 1 END) as unpaid_count
       FROM salary_entries se
       JOIN salary_periods sp ON se.period_id = sp.id
       WHERE sp.month=? AND sp.year=?`,
      [month, year]
    );

    const [deptStats] = await pool.query<any[]>(
      `SELECT d.name, COUNT(e.id) as count FROM departments d
       LEFT JOIN employees e ON d.id = e.department_id AND e.status='active'
       GROUP BY d.id, d.name ORDER BY count DESC`
    );

    // Financial & Salary Visibility Whitelist (Need-to-Know Principle)
    const canViewFinancials = ['admin', 'hr', 'payroll_operator', 'payroll_approver'].includes(req.user?.role || '');

    // Increment alerts: Employees who completed 1+ year and have pending increment approval
    // Note: The annual increment cycle for the current year is already completed.
    let incrementDue: any[] = [];
    if (canViewFinancials) {
      try {
        const [cycleSetting]: any = await pool.query(
          `SELECT setting_value FROM system_settings WHERE setting_key = 'annual_increment_cycle_year'`
        );
        const cycleYear = cycleSetting[0]?.setting_value ? parseInt(cycleSetting[0].setting_value) : year;

        // Only check for increment due if annual cycle is behind current year
        if (cycleYear < year) {
          const [rows] = await pool.query<any[]>(
            `SELECT e.id, e.emp_code, e.name, e.basic_salary, e.initial_basic_salary, e.increment_rate, e.joining_date,
              d.name as department_name,
              TIMESTAMPDIFF(YEAR, e.joining_date, CURDATE()) as completed_years
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE e.status = 'active'
               AND e.joining_date IS NOT NULL
               AND e.joining_date <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
               AND e.last_increment_date IS NOT NULL
               AND e.last_increment_date <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
               AND YEAR(e.last_increment_date) < ?
             ORDER BY e.joining_date ASC`,
            [year]
          );
          incrementDue = rows;
        }
      } catch (e) {
        console.warn('Increment due query note:', e);
      }
    }

    // Pending salary approvals: manager-enrolled employees requiring admin salary sign-off
    const [pendingSalaryApprovalsRaw] = await pool.query<any[]>(
      `SELECT e.id, e.emp_code, e.name, e.basic_salary, e.salary_per_day, e.joining_date, 
              e.phone, e.address, e.job_role, e.referred_by_emp_id, e.referred_by_name, e.referred_by_phone,
              e.monthly_advance_deduction,
              d.name as department_name, u.full_name as creator_name,
              ref.name as referred_by_emp_name, ref.emp_code as referred_by_emp_code,
              c.name as city_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN employees ref ON e.referred_by_emp_id = ref.id
       LEFT JOIN cities c ON e.city_id = c.id
       WHERE e.salary_approved = 0 AND e.status = 'active'
       ORDER BY e.created_at DESC`
    );

    const pendingSalaryApprovals = pendingSalaryApprovalsRaw.map(emp => {
      if (!canViewFinancials) {
        return {
          ...emp,
          basic_salary: 'Confidential',
          salary_per_day: 'Confidential',
          monthly_advance_deduction: null,
          _is_salary_hidden: true
        };
      }
      return emp;
    });

    // Pending advance requests from managers
    let pendingAdvanceCount = 0;
    try {
      const [advReqCount]: any = await pool.query('SELECT COUNT(*) as count FROM advance_requests WHERE status = "pending"');
      pendingAdvanceCount = advReqCount[0]?.count || 0;
    } catch (e) {}

    // Alerts
    const alerts: string[] = [];
    if (pendingSalaryApprovals.length > 0) {
      alerts.push(`⚠️ ${pendingSalaryApprovals.length} newly enrolled employee(s) have pending Basic Salary approvals from Manager enrollment.`);
    }
    if (pendingAdvanceCount > 0) {
      alerts.push(`💳 ${pendingAdvanceCount} Advance Request(s) submitted by Shift Managers pending Admin Approval.`);
    }
    if (parseInt(attStats[0].absent) > 0) alerts.push(`${attStats[0].absent} employees absent today`);
    if (canViewFinancials && parseInt(salaryStats[0].unpaid_count) > 0) {
      alerts.push(`${salaryStats[0].unpaid_count} employees have unpaid salary this month`);
    }
    if (parseInt(attStats[0].late) > 0) alerts.push(`${attStats[0].late} late arrivals today`);
    if (incrementDue.length > 0) {
      alerts.push(`🎉 ${incrementDue.length} employee(s) completed 1+ year tenure and require Admin Increment Approval!`);
    }

    res.json({
      success: true,
      employees: empStats[0],
      attendance: attStats[0],
      salary: canViewFinancials ? salaryStats[0] : null,
      departments: deptStats,
      increments_due: incrementDue,
      pending_salary_approvals: pendingSalaryApprovals,
      pending_advance_count: pendingAdvanceCount,
      alerts,
      period: { month, year },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const [logs] = await pool.query<any[]>(
      `SELECT al.*, u.full_name FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 10`
    );
    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error('Error fetching recent-activity audit logs:', err?.message || err);
    res.json({ success: true, data: [] });
  }
});

export default router;
