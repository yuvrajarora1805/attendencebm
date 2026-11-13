import { Router, Request, Response } from 'express';
import * as XLSX from 'xlsx';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/reports/salary/excel?period_id=X
router.get('/salary/excel', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver'), async (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;
    if (!period_id) return res.status(400).json({ success: false, message: 'period_id is required' });

    const [entries]: any = await pool.query(
      `SELECT e.emp_code as "Emp Code", e.name as "Employee Name", d.name as "Department",
              s.basic_salary as "Basic Salary", s.salary_per_day as "Per Day",
              s.worked_days as "Worked Days", s.present_days as "Present",
              s.absent_days as "Absent", s.half_days as "Half Days",
              s.final_leaves as "Final Leaves", s.leaves_amount as "Leaves Deduction",
              s.op_balance as "Op Balance", s.advance_given as "Advance Given",
              s.advance_deduction as "Advance Deducted", s.advance_cf as "Advance C/F",
              s.other_incentives as "Incentives", s.other_deduction as "Other Deductions",
              s.net_salary as "Net Salary", s.gross_amount as "Gross Payable",
              s.payment_mode as "Mode", s.payment_status as "Status"
       FROM salary_entries s
       JOIN employees e ON s.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE s.period_id = ? AND e.status = 'active'
       ORDER BY e.emp_code ASC`,
      [period_id]
    );

    const worksheet = XLSX.utils.json_to_sheet(entries);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Sheet');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=salary_sheet_period_${period_id}.xlsx`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/attendance/excel?month=X&year=Y
router.get('/attendance/excel', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver'), async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [rows]: any = await pool.query(
      `SELECT a.date as "Date", e.emp_code as "Emp Code", e.name as "Name",
              d.name as "Department", a.punch_in as "Punch In", a.punch_out as "Punch Out",
              a.status as "Status", a.is_late as "Is Late", a.overtime_hours as "Overtime Hours"
       FROM attendance_records a
       JOIN employees e ON a.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE a.date >= ? AND a.date <= ?
       ORDER BY a.date ASC, e.emp_code ASC`,
      [startDate, endDate]
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${year}_${month}.xlsx`);
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/payslip/:entryId
router.get('/payslip/:entryId', authorizeRoles('admin', 'hr', 'payroll_operator', 'payroll_approver'), async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const [rows]: any = await pool.query(
      `SELECT s.*, e.name as emp_name, e.emp_code, e.bank_account, e.bank_name, e.ifsc_code,
              d.name as department, p.month, p.year
       FROM salary_entries s
       JOIN employees e ON s.emp_id = e.id
       LEFT JOIN departments d ON e.department_id = d.id
       JOIN salary_periods p ON s.period_id = p.id
       WHERE s.id = ?`,
      [entryId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Payslip not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
