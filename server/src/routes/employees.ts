import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { auditLog } from '../utils/auditLogger';

const router = Router();
router.use(authenticate);

// GET /api/employees - List all
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, department_id, search } = req.query;
    let query = `
      SELECT e.*, d.name as department_name, c.name as city_name, jp.name as posting_name,
             ref.name as referred_by_emp_name, ref.emp_code as referred_by_emp_code,
             approver.full_name as salary_approved_by_name,
             (SELECT type FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_type,
             (SELECT increment_percent FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_percent
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN cities c ON e.city_id = c.id
      LEFT JOIN job_postings jp ON e.posting_id = jp.id
      LEFT JOIN employees ref ON e.referred_by_emp_id = ref.id
      LEFT JOIN users approver ON e.salary_approved_by = approver.id
      WHERE 1=1`;
    const params: any[] = [];

    if (status) { query += ' AND e.status = ?'; params.push(status); }
    if (department_id) { query += ' AND e.department_id = ?'; params.push(department_id); }
    if (search) {
      query += ' AND (e.name LIKE ? OR e.emp_code LIKE ? OR e.job_role LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY e.name ASC';

    const [rows] = await pool.query<any[]>(query, params);
    
    // Mask salary and financial increment data for non-payroll roles (Managers, Guards, Viewers)
    const canViewSalary = ['admin', 'hr', 'payroll_operator', 'payroll_approver'].includes(req.user?.role || '');
    const processedRows = rows.map(emp => {
      if (!canViewSalary) {
        return {
          ...emp,
          basic_salary: 'Confidential',
          salary_per_day: 'Confidential',
          initial_basic_salary: null,
          increment_rate: null,
          _is_salary_hidden: true
        };
      }
      return emp;
    });

    res.json({ success: true, data: processedRows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/departments/list or /api/employees/meta/departments
router.get(['/departments/list', '/meta/departments', '/departments'], async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT d.*, COUNT(e.id) as emp_count 
       FROM departments d 
       LEFT JOIN employees e ON d.id = e.department_id 
       GROUP BY d.id 
       ORDER BY d.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees/departments - Create New Section with Series Range
router.post('/departments', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { name, description, code_start, code_end } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Section/Department name is required' });
  }
  try {
    const [result] = await pool.query<any>(
      `INSERT INTO departments (name, description, code_start, code_end) VALUES (?, ?, ?, ?)`,
      [name.trim(), description || null, code_start ? parseInt(code_start) : null, code_end ? parseInt(code_end) : null]
    );
    res.status(201).json({
      success: true,
      message: `Section "${name}" created with series range ${code_start || 'auto'} - ${code_end || 'auto'}`,
      id: result.insertId
    });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A section with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error creating section' });
  }
});

// PUT /api/employees/departments/:id - Edit Existing Section Name & Series Range
router.put('/departments/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { name, description, code_start, code_end } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Section/Department name is required' });
  }
  try {
    await pool.query(
      `UPDATE departments SET name=?, description=?, code_start=?, code_end=? WHERE id=?`,
      [name.trim(), description || null, code_start ? parseInt(code_start) : null, code_end ? parseInt(code_end) : null, req.params.id]
    );
    res.json({ success: true, message: `Section updated successfully` });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A section with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error updating section' });
  }
});

// DELETE /api/employees/departments/:id - Delete section (if no employees linked)
router.delete('/departments/:id', authorizeRoles('admin', 'hr'), async (req: Request, res: Response) => {
  try {
    const [empRows] = await pool.query<any[]>('SELECT COUNT(*) as cnt FROM employees WHERE department_id = ?', [req.params.id]);
    if (empRows[0].cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete section: It currently contains ${empRows[0].cnt} employee profiles.`
      });
    }
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Section removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error deleting section' });
  }
});

// GET /api/employees/series-info - Get allocated code series with configured start-end range
router.get('/series-info', async (req: Request, res: Response) => {
  try {
    const [departments] = await pool.query<any[]>(
      `SELECT d.id, d.name, d.description, d.code_start, d.code_end, COUNT(e.id) as emp_count
       FROM departments d
       LEFT JOIN employees e ON d.id = e.department_id
       GROUP BY d.id, d.name
       ORDER BY d.name ASC`
    );

    const [allEmployees] = await pool.query<any[]>(
      `SELECT department_id, emp_code FROM employees WHERE department_id IS NOT NULL`
    );

    const seriesData = departments.map(dept => {
      const deptEmps = allEmployees.filter(e => e.department_id === dept.id);
      const codes = deptEmps.map(e => String(e.emp_code).trim()).filter(Boolean);

      // Determine numeric codes
      const numericCodes = codes
        .filter(c => /^\d+$/.test(c))
        .map(c => parseInt(c, 10))
        .sort((a, b) => a - b);

      let seriesPrefix = '';
      let nextSuggestedCode = '';
      let formatLength = 4;

      if (dept.code_start && dept.code_end) {
        seriesPrefix = `${dept.code_start} - ${dept.code_end}`;
        formatLength = String(dept.code_start).length;

        // Find next free code within range [code_start, code_end]
        let candidate = dept.code_start;
        while (numericCodes.includes(candidate) && candidate <= dept.code_end) {
          candidate++;
        }
        if (candidate <= dept.code_end) {
          nextSuggestedCode = String(candidate).padStart(formatLength, '0');
        } else {
          nextSuggestedCode = String(candidate);
        }
      } else if (numericCodes.length > 0) {
        const sampleStr = codes.find(c => /^\d+$/.test(c)) || '';
        formatLength = sampleStr.length;
        const maxCode = numericCodes[numericCodes.length - 1];
        const minCode = numericCodes[0];
        const nextNum = maxCode + 1;
        nextSuggestedCode = String(nextNum).padStart(formatLength, '0');
        seriesPrefix = `${minCode} - ${maxCode + 50}`;
      } else {
        const fallbackStart = (dept.id * 1000) + 1;
        const fallbackEnd = (dept.id * 1000) + 100;
        nextSuggestedCode = String(fallbackStart);
        seriesPrefix = `${fallbackStart} - ${fallbackEnd}`;
      }

      return {
        dept_id: dept.id,
        dept_name: dept.name,
        code_start: dept.code_start,
        code_end: dept.code_end,
        emp_count: dept.emp_count,
        sample_codes: codes.slice(0, 5),
        series_prefix: seriesPrefix,
        next_suggested_code: nextSuggestedCode,
      };
    });

    res.json({ success: true, data: seriesData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/increments/due - Get employees completing 1-year tenure
router.get('/increments/due', async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const [cycleSetting]: any = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'annual_increment_cycle_year'`
    );
    const cycleYear = cycleSetting[0]?.setting_value ? parseInt(cycleSetting[0].setting_value) : currentYear;

    if (cycleYear >= currentYear) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT e.*, d.name as department_name,
        TIMESTAMPDIFF(YEAR, e.joining_date, CURDATE()) as completed_years,
        DATEDIFF(CURDATE(), e.joining_date) as tenure_days
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.status = 'active'
         AND e.joining_date IS NOT NULL
         AND e.joining_date <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
         AND e.last_increment_date IS NOT NULL
         AND e.last_increment_date <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
         AND YEAR(e.last_increment_date) < ?
       ORDER BY e.joining_date ASC`,
      [currentYear]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees/increments/mark-cycle-done - Mark annual increment cycle as completed (ADMIN ONLY)
router.post('/increments/mark-cycle-done', authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES ('annual_increment_cycle_year', ?, 'Year up to which annual increments are completed')
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [String(currentYear), String(currentYear)]
    );

    await pool.query(
      `UPDATE employees 
       SET last_increment_date = ?,
           initial_basic_salary = COALESCE(basic_salary, initial_basic_salary)
       WHERE (last_increment_date IS NULL OR YEAR(last_increment_date) < ?)`,
      [today, currentYear]
    );

    res.json({
      success: true,
      message: `Annual increment cycle for ${currentYear} marked as completed. All employee salaries are up to date.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees/increments/apply - Apply increment (Annual, Manual, or No Increment) (ADMIN ONLY)
router.post('/increments/apply', authorizeRoles('admin'), async (req: Request, res: Response) => {
  const { emp_id, type = 'annual_1yr', increment_percent, new_basic, notes } = req.body;
  if (!emp_id) return res.status(400).json({ success: false, message: 'emp_id required' });

  try {
    const [rows] = await pool.query<any[]>(
      `SELECT *, TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) as completed_years FROM employees WHERE id = ?`,
      [emp_id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = rows[0];

    const oldBasic = Number(emp.basic_salary) || 0;
    const today = new Date().toISOString().split('T')[0];

    // Case 1: Option NOT to do the increment (Skip / No Increment)
    if (type === 'no_increment') {
      await pool.query(
        `UPDATE employees SET last_increment_date = ? WHERE id = ?`,
        [today, emp_id]
      );

      await pool.query(
        `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
         VALUES (?, ?, ?, 0.00, ?, 'no_increment', ?, ?)`,
        [emp_id, oldBasic, oldBasic, today, notes || 'Admin opted not to provide increment for this cycle', req.user!.id]
      );

      return res.json({
        success: true,
        message: `No increment recorded for ${emp.name}. Salary remains ₹${oldBasic.toLocaleString()} (Cycle marked as complete).`,
        data: { oldBasic, newBasic: oldBasic, rate: 0, newPerDay: Number(emp.salary_per_day) || 0, type: 'no_increment' }
      });
    }

    // Case 2: Manual Increment (custom new basic salary or custom rate)
    if (type === 'manual' || new_basic !== undefined) {
      let finalBasic = oldBasic;
      let rate = 0;
      if (new_basic !== undefined && Number(new_basic) > 0) {
        finalBasic = Math.round(Number(new_basic));
        rate = oldBasic > 0 ? parseFloat((((finalBasic - oldBasic) / oldBasic) * 100).toFixed(2)) : 0;
      } else {
        rate = Number(increment_percent !== undefined ? increment_percent : 5.0);
        finalBasic = Math.round(oldBasic * (1 + rate / 100));
      }
      const finalPerDay = parseFloat((finalBasic / 30).toFixed(2));

      await pool.query(
        `UPDATE employees 
         SET basic_salary = ?, salary_per_day = ?, initial_basic_salary = ?, last_increment_date = ?
         WHERE id = ?`,
        [finalBasic, finalPerDay, finalBasic, today, emp_id]
      );

      await pool.query(
        `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)`,
        [emp_id, oldBasic, finalBasic, rate, today, notes || `Manual Salary Increment (+${rate}%)`, req.user!.id]
      );

      return res.json({
        success: true,
        message: `Manual Increment of ₹${(finalBasic - oldBasic).toLocaleString()} (+${rate}%) applied for ${emp.name}: Basic revised to ₹${finalBasic.toLocaleString()} (₹${finalPerDay}/day).`,
        data: { oldBasic, newBasic: finalBasic, rate, newPerDay: finalPerDay, type: 'manual' }
      });
    }

    // Case 3: Standard Annual Increment (+rate% on current basic)
    const rate = Number(increment_percent !== undefined ? increment_percent : (emp.increment_rate || 5.0));
    const finalBasic = Math.round(oldBasic * (1 + rate / 100));
    const newPerDay = parseFloat((finalBasic / 30).toFixed(2));

    await pool.query(
      `UPDATE employees 
       SET basic_salary = ?, salary_per_day = ?, initial_basic_salary = ?, last_increment_date = ?
       WHERE id = ?`,
      [finalBasic, newPerDay, finalBasic, today, emp_id]
    );

    await pool.query(
      `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'annual_1yr', ?, ?)`,
      [emp_id, oldBasic, finalBasic, rate, today, notes || `Annual Increment (${rate}%)`, req.user!.id]
    );

    res.json({
      success: true,
      message: `Annual Increment of ${rate}% applied for ${emp.name}: Basic revised from ₹${oldBasic.toLocaleString()} to ₹${finalBasic.toLocaleString()} (₹${newPerDay}/day).`,
      data: { oldBasic, newBasic: finalBasic, rate, newPerDay, type: 'annual_1yr' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees/increments/bulk-action - Bulk approve or mark no increment (ADMIN ONLY)
router.post('/increments/bulk-action', authorizeRoles('admin'), async (req: Request, res: Response) => {
  const { action, emp_ids, increment_percent, notes } = req.body;
  if (!['approve', 'no_increment'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Valid action (approve | no_increment) is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    let targetEmployees: any[] = [];

    if (Array.isArray(emp_ids) && emp_ids.length > 0) {
      const [rows] = await pool.query<any[]>(
        `SELECT id, name, basic_salary, increment_rate FROM employees WHERE id IN (?)`,
        [emp_ids]
      );
      targetEmployees = rows;
    } else {
      const [rows] = await pool.query<any[]>(
        `SELECT id, name, basic_salary, increment_rate FROM employees 
         WHERE status = 'active' 
           AND (last_increment_date IS NULL OR YEAR(last_increment_date) < YEAR(CURDATE()))`
      );
      targetEmployees = rows;
    }

    if (!targetEmployees.length) {
      return res.json({ success: true, message: 'No eligible employees found for this action.' });
    }

    let processed = 0;
    for (const emp of targetEmployees) {
      const oldBasic = Number(emp.basic_salary) || 0;
      if (action === 'no_increment') {
        await pool.query('UPDATE employees SET last_increment_date = ? WHERE id = ?', [today, emp.id]);
        await pool.query(
          `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
           VALUES (?, ?, ?, 0.00, ?, 'no_increment', ?, ?)`,
          [emp.id, oldBasic, oldBasic, today, notes || 'Bulk action: No increment for this cycle', req.user!.id]
        );
      } else {
        const rate = Number(increment_percent !== undefined ? increment_percent : (emp.increment_rate || 5.0));
        const newBasic = Math.round(oldBasic * (1 + rate / 100));
        const newPerDay = parseFloat((newBasic / 30).toFixed(2));
        await pool.query(
          `UPDATE employees SET basic_salary = ?, salary_per_day = ?, initial_basic_salary = ?, last_increment_date = ? WHERE id = ?`,
          [newBasic, newPerDay, newBasic, today, emp.id]
        );
        await pool.query(
          `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
           VALUES (?, ?, ?, ?, ?, 'annual_1yr', ?, ?)`,
          [emp.id, oldBasic, newBasic, rate, today, notes || `Bulk Annual Increment (${rate}%)`, req.user!.id]
        );
      }
      processed++;
    }

    res.json({
      success: true,
      message: action === 'no_increment'
        ? `Marked 'No Increment' for ${processed} employee(s) for this cycle.`
        : `Approved increment for ${processed} employee(s).`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/:id/increments - Get increment history for an employee
router.get('/:id/increments', async (req: Request, res: Response) => {
  try {
    const isManager = req.user?.role === 'manager';
    if (isManager) {
      return res.status(403).json({ success: false, message: 'Salary increment history is restricted to Admin view' });
    }
    const [rows] = await pool.query<any[]>(
      `SELECT si.*, u.full_name as creator_name 
       FROM salary_increments si
       LEFT JOIN users u ON si.created_by = u.id
       WHERE si.emp_id = ?
       ORDER BY si.effective_date DESC, si.id DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT e.*, d.name as department_name, c.name as city_name, jp.name as posting_name,
              ref.name as referred_by_emp_name, ref.emp_code as referred_by_emp_code,
              approver.full_name as salary_approved_by_name,
              (SELECT type FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_type,
              (SELECT increment_percent FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_percent
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN cities c ON e.city_id = c.id
       LEFT JOIN job_postings jp ON e.posting_id = jp.id
       LEFT JOIN employees ref ON e.referred_by_emp_id = ref.id
       LEFT JOIN users approver ON e.salary_approved_by = approver.id
       WHERE e.id = ? OR e.emp_code = ?`,
      [req.params.id, req.params.id]
    );
    if (!rows.length) { res.status(404).json({ success: false, message: 'Employee not found' }); return; }
    
    let empData = rows[0];
    const canViewSalary = ['admin', 'hr', 'payroll_operator', 'payroll_approver'].includes(req.user?.role || '');
    if (!canViewSalary) {
      empData = {
        ...empData,
        basic_salary: 'Confidential',
        salary_per_day: 'Confidential',
        initial_basic_salary: null,
        increment_rate: null,
        _is_salary_hidden: true
      };
    }

    res.json({ success: true, data: empData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/employees/:id/analytics
router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const paramId = req.params.id;
    const [empRows] = await pool.query<any[]>(
      `SELECT e.*, d.name as department_name, c.name as city_name, jp.name as posting_name,
              ref.name as referred_by_emp_name, ref.emp_code as referred_by_emp_code,
              approver.full_name as salary_approved_by_name,
              (SELECT type FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_type,
              (SELECT increment_percent FROM salary_increments WHERE emp_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1) as last_increment_percent
       FROM employees e 
       LEFT JOIN departments d ON e.department_id = d.id 
       LEFT JOIN cities c ON e.city_id = c.id
       LEFT JOIN job_postings jp ON e.posting_id = jp.id
       LEFT JOIN employees ref ON e.referred_by_emp_id = ref.id
       LEFT JOIN users approver ON e.salary_approved_by = approver.id
       WHERE e.id = ? OR e.emp_code = ?`,
      [paramId, paramId]
    );
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = empRows[0];
    const actualEmpId = emp.id;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const prevDate = new Date(curYear, curMonth - 2, 1);
    const lastMonth = prevDate.getMonth() + 1;
    const lastMonthYear = prevDate.getFullYear();

    // 1. Current Month stats from attendance_records (fallback to salary_entries if empty)
    const [curMonthRows] = await pool.query<any[]>(
      `SELECT status, COUNT(*) as cnt, SUM(overtime_hours) as ot
       FROM attendance_records 
       WHERE emp_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0
       GROUP BY status`,
      [actualEmpId, curMonth, curYear]
    );

    // 2. Last Month stats from attendance_records (fallback to salary_entries if empty)
    const [lastMonthRows] = await pool.query<any[]>(
      `SELECT status, COUNT(*) as cnt, SUM(overtime_hours) as ot
       FROM attendance_records 
       WHERE emp_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND is_archived = 0
       GROUP BY status`,
      [actualEmpId, lastMonth, lastMonthYear]
    );

    // Also check salary_entries for this month and last month
    const [curSalaryRows] = await pool.query<any[]>(
      `SELECT se.* FROM salary_entries se 
       JOIN salary_periods sp ON se.period_id = sp.id 
       WHERE se.emp_id = ? AND sp.month = ? AND sp.year = ? LIMIT 1`,
      [actualEmpId, curMonth, curYear]
    );
    const curSal = curSalaryRows[0];

    const [lastSalaryRows] = await pool.query<any[]>(
      `SELECT se.* FROM salary_entries se 
       JOIN salary_periods sp ON se.period_id = sp.id 
       WHERE se.emp_id = ? AND sp.month = ? AND sp.year = ? LIMIT 1`,
      [actualEmpId, lastMonth, lastMonthYear]
    );
    const lastSal = lastSalaryRows[0];

    // Helper parser
    const parseStats = (rows: any[], salEntry?: any) => {
      let present = 0, late = 0, absent = 0, half_day = 0, on_leave = 0, ot = 0;
      let actualLeaves = 0;
      let finalLeaves = 0;

      if (salEntry) {
        // Use verified payroll values when available
        actualLeaves = Number(salEntry.actual_leaves) || 0;
        finalLeaves = Number(salEntry.final_leaves) || 0;
        present = Number(salEntry.present_days) || 0;
        absent = finalLeaves;
      } else if (rows && rows.length > 0) {
        rows.forEach(r => {
          const s = (r.status || '').toLowerCase();
          const c = Number(r.cnt) || 0;
          ot += Number(r.ot) || 0;
          if (s === 'present') present += c;
          else if (s === 'late') late += c;
          else if (s === 'absent') absent += c;
          else if (s === 'half-day' || s === 'half_day') half_day += c;
          else if (s === 'on-leave' || s === 'leave' || s === 'on_leave') on_leave += c;
        });
        actualLeaves = absent + on_leave;
        finalLeaves = absent + on_leave;
      }

      const allowedPaidLeaves = Math.max(0, actualLeaves - finalLeaves);

      return {
        present,
        late,
        absent,
        half_day,
        on_leave,
        actual_leaves: actualLeaves,
        final_leaves: finalLeaves,
        allowed_paid_leaves: allowedPaidLeaves,
        total_present_effective: present + late + (half_day * 0.5),
        overtime_hours: parseFloat(ot.toFixed(2))
      };
    };

    const currentMonthStats = parseStats(curMonthRows, curSal);
    const lastMonthStats = parseStats(lastMonthRows, lastSal);

    // 3. Past 6 months trend (Union attendance_records and salary_entries)
    const [trendRows] = await pool.query<any[]>(
      `SELECT 
        sp.year as yr, 
        sp.month as mo, 
        se.working_days,
        se.present_days,
        se.final_leaves as absent_days,
        0 as leave_days,
        0 as ot_hours
       FROM salary_entries se
       JOIN salary_periods sp ON se.period_id = sp.id
       WHERE se.emp_id = ?
       ORDER BY sp.year DESC, sp.month DESC
       LIMIT 6`,
      [actualEmpId]
    );
    const trendSorted = (trendRows || []).reverse();

    // 4. All time / yearly summary
    const [yearlySummary] = await pool.query<any[]>(
      `SELECT 
        COUNT(*) as total_punches,
        SUM(CASE WHEN status IN ('present', 'late') THEN 1 WHEN status = 'half-day' THEN 0.5 ELSE 0 END) as total_present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as total_absent,
        SUM(CASE WHEN status IN ('on-leave', 'leave') THEN 1 ELSE 0 END) as total_leave,
        SUM(overtime_hours) as total_ot,
        SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(punch_in)))) as avg_punch_in,
        SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(punch_out)))) as avg_punch_out
       FROM attendance_records
       WHERE emp_id = ? AND is_archived = 0`,
      [actualEmpId]
    );

    // 5. Advance Balance & Calculation (excludes legacy MDB monthly salary payment vouchers)
    const [advRows]: any = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as total_given,
        COALESCE(SUM(CASE WHEN type = 'deduction' THEN amount ELSE 0 END), 0) as total_deducted
       FROM advance_transactions 
       WHERE emp_id = ?
         AND remarks NOT LIKE 'SALARY PAID%'
         AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}$'`,
      [actualEmpId]
    );
    const totalGiven = Number(advRows[0]?.total_given || 0);
    const totalDeducted = Number(advRows[0]?.total_deducted || 0);

    // Chronological transactions to compute running debt balance
    const [advanceHistoryRaw]: any = await pool.query(
      `SELECT a.*, u.username as created_by_name 
       FROM advance_transactions a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.emp_id = ? 
         AND a.remarks NOT LIKE 'SALARY PAID%'
         AND a.remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}$'
       ORDER BY a.date ASC, a.id ASC`,
      [actualEmpId]
    );

    let runningDebt = 0;
    const advanceHistory = advanceHistoryRaw.map((tx: any) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'given') {
        runningDebt += amt;
      } else {
        runningDebt -= amt;
      }
      return {
        ...tx,
        balance_after: Math.max(0, runningDebt)
      };
    }).reverse();

    // Net outstanding debt is the true financial ledger balance
    const netOutstandingDebt = Math.max(0, totalGiven - totalDeducted);
    const currentAdvanceBalance = netOutstandingDebt;

    // Active cycles only exist if there is an unpaid outstanding debt
    let remainingToAllocate = netOutstandingDebt;
    const activeCycles: any[] = [];

    if (netOutstandingDebt > 0) {
      // Find the most recent given advances that make up this outstanding debt
      const givenAdvances = advanceHistoryRaw
        .filter((tx: any) => tx.type === 'given')
        .reverse(); // latest first

      for (const adv of givenAdvances) {
        if (remainingToAllocate <= 0) break;
        const advAmt = Number(adv.amount) || 0;
        const cycleBalance = Math.min(advAmt, remainingToAllocate);
        activeCycles.push({
          id: adv.id,
          date: adv.date,
          amount: advAmt,
          mode: adv.mode || 'cash',
          remarks: adv.remarks,
          monthly_deduction: adv.monthly_deduction || 0,
          recovered_amount: advAmt - cycleBalance,
          remaining_balance: cycleBalance
        });
        remainingToAllocate -= cycleBalance;
      }
    }

    const totalActiveMonthlyCut = activeCycles.reduce((sum: number, c: any) => sum + Number(c.monthly_deduction || 0), 0);
    const effectiveMonthlyCut = totalActiveMonthlyCut > 0 ? totalActiveMonthlyCut : (Number(emp.monthly_advance_deduction) || 0);

    // Advance Requests (Pending, Approved, Rejected) for this employee
    const [advanceRequests]: any = await pool.query(
      `SELECT ar.*, 
              u.full_name as requested_by_name, u.username as requested_by_username,
              rev.full_name as reviewed_by_name
       FROM advance_requests ar
       LEFT JOIN users u ON ar.requested_by = u.id
       LEFT JOIN users rev ON ar.reviewed_by = rev.id
       WHERE ar.emp_id = ?
       ORDER BY ar.created_at DESC, ar.id DESC LIMIT 30`,
      [actualEmpId]
    );

    const salaryPerDay = Number(emp.salary_per_day) || (Number(emp.basic_salary || 0) / 30);
    const daysWorkedSoFar = currentMonthStats.total_present_effective;
    const earnedSoFar = daysWorkedSoFar * salaryPerDay;
    // Expected advance cap = 50% of the earned/worked days so far
    const maxExpectedAdvance = Math.round(earnedSoFar * 0.50);
    const netAvailableAdvance = Math.max(0, maxExpectedAdvance - currentAdvanceBalance);

    // 6. Recent records for mini-calendar or history table
    const [recentPunches] = await pool.query<any[]>(
      `SELECT * FROM attendance_records WHERE emp_id = ? AND is_archived = 0 ORDER BY date DESC LIMIT 31`,
      [actualEmpId]
    );

    const canViewSalary = ['admin', 'hr', 'payroll_operator', 'payroll_approver'].includes(req.user?.role || '');
    const hideSalaryDetails = !canViewSalary;

    // 7. Salary history entries for this employee
    // Only released periods are shown to managers; admin/payroll see all
    const [salaryHistory] = await pool.query<any[]>(
      `SELECT se.*, sp.month, sp.year, sp.is_released, sp.status as period_status, sp.released_at
       FROM salary_entries se
       JOIN salary_periods sp ON se.period_id = sp.id
       WHERE se.emp_id = ? ${hideSalaryDetails ? 'AND sp.is_released = 1' : ''}
       ORDER BY sp.year DESC, sp.month DESC
       LIMIT 12`,
      [actualEmpId]
    );

    const sanitizedEmp = hideSalaryDetails ? {
      ...emp,
      basic_salary: undefined,
      salary_per_day: undefined,
      initial_basic_salary: undefined,
      increment_rate: undefined,
      _is_salary_hidden: true
    } : emp;

    res.json({
      success: true,
      data: {
        employee: sanitizedEmp,
        this_month: {
          month: curMonth,
          year: curYear,
          ...currentMonthStats,
          earned_so_far: hideSalaryDetails ? undefined : Math.round(earnedSoFar)
        },
        last_month: {
          month: lastMonth,
          year: lastMonthYear,
          ...lastMonthStats
        },
        advance_info: hideSalaryDetails ? {
          days_worked_so_far: daysWorkedSoFar,
          advance_percentage_rule: 50,
          current_advance_balance: currentAdvanceBalance,
          total_given: totalGiven,
          total_deducted: totalDeducted,
          active_cycles: activeCycles,
          total_active_monthly_cut: effectiveMonthlyCut
        } : {
          salary_per_day: Math.round(salaryPerDay),
          days_worked_so_far: daysWorkedSoFar,
          earned_so_far: Math.round(earnedSoFar),
          advance_percentage_rule: 50,
          max_expected_advance: maxExpectedAdvance,
          current_advance_balance: currentAdvanceBalance,
          net_available_advance: netAvailableAdvance,
          total_given: totalGiven,
          total_deducted: totalDeducted,
          monthly_advance_deduction: effectiveMonthlyCut,
          active_cycles: activeCycles,
          total_active_monthly_cut: effectiveMonthlyCut,
          months_to_clear_advance: (effectiveMonthlyCut > 0 && currentAdvanceBalance > 0)
            ? Math.ceil(currentAdvanceBalance / effectiveMonthlyCut)
            : null
        },
        trend: trendSorted,
        yearly_summary: yearlySummary[0] || {},
        recent_records: recentPunches,
        salary_history: hideSalaryDetails ? [] : (salaryHistory || []),
        advance_history: advanceHistory || [],
        advance_requests: advanceRequests || [],
        increments: hideSalaryDetails ? [] : (await pool.query<any[]>(
          `SELECT si.*, u.full_name as creator_name 
           FROM salary_increments si
           LEFT JOIN users u ON si.created_by = u.id
           WHERE si.emp_id = ?
           ORDER BY si.effective_date DESC, si.id DESC`,
          [actualEmpId]
        ))[0]
      }
    });
  } catch (err: any) {
    console.error('Error fetching employee analytics', err);
    res.status(500).json({ success: false, message: 'Server error fetching analytics' });
  }
});

// GET /api/employees/:id/stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const paramId = req.params.id;
    const [eRows]: any = await pool.query('SELECT id FROM employees WHERE id = ? OR emp_code = ? LIMIT 1', [paramId, paramId]);
    const empId = eRows.length ? eRows[0].id : paramId;

    const [totalAtt] = await pool.query<any[]>(
      'SELECT COUNT(*) as total, SUM(CASE WHEN status="present" OR status="late" THEN 1 ELSE 0 END) as present FROM attendance_records WHERE emp_id = ? AND is_archived = 0',
      [empId]
    );
    const [advBalance] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE -amount END), 0) as balance 
       FROM advance_transactions 
       WHERE emp_id = ?
         AND remarks NOT LIKE 'SALARY PAID%'
         AND remarks NOT REGEXP '^SALARY [A-Za-z]+ [0-9]{4}'`,
      [empId]
    );
    const [lastSalary] = await pool.query<any[]>(
      `SELECT se.*, sp.month, sp.year FROM salary_entries se
       JOIN salary_periods sp ON se.period_id = sp.id
       WHERE se.emp_id = ? ORDER BY sp.year DESC, sp.month DESC LIMIT 1`,
      [empId]
    );
    res.json({
      success: true,
      data: {
        attendance: totalAtt[0],
        advance_balance: advBalance[0]?.balance || 0,
        last_salary: lastSalary[0] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/employees - Create
router.post('/', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { 
    emp_code, name, department_id, job_role, basic_salary, salary_per_day, increment_rate = 5.0, 
    joining_date, phone, email, address, city_id,
    referred_by_emp_id, referred_by_name, referred_by_phone, monthly_advance_deduction
  } = req.body;
  if (!emp_code || !name) { res.status(400).json({ success: false, message: 'emp_code and name required' }); return; }
  try {
    // When created by manager, salary requires admin approval (salary_approved = 0)
    const isManager = req.user?.role === 'manager';
    const salaryApproved = isManager ? 0 : 1;
    const salaryApprovedBy = isManager ? null : req.user!.id;

    const [result] = await pool.query<any>(
      `INSERT INTO employees (
        emp_code, name, department_id, job_role, basic_salary, salary_per_day, increment_rate, 
        joining_date, phone, email, address, city_id,
        referred_by_emp_id, referred_by_name, referred_by_phone,
        salary_approved, salary_approved_by, monthly_advance_deduction, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emp_code, name, department_id || null, job_role || null, basic_salary || 0, salary_per_day || 0, increment_rate || 5.0, 
        joining_date || null, phone || null, email || null, address || null, city_id || null,
        referred_by_emp_id || null, referred_by_name || null, referred_by_phone || null,
        salaryApproved, salaryApprovedBy, monthly_advance_deduction || 0, req.user!.id
      ]
    );
    await auditLog(req.user!.id, req.user!.username, 'create', 'employees', result.insertId, `EMP:${emp_code}`, { name, salaryApproved }, null, req);
    res.status(201).json({ 
      success: true, 
      message: isManager 
        ? 'Employee enrolled! Basic salary pending Admin approval.' 
        : 'Employee created successfully.', 
      id: result.insertId,
      salary_approved: salaryApproved
    });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') { res.status(409).json({ success: false, message: 'Employee code already exists' }); return; }
    console.error('Error creating employee:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authorizeRoles('admin', 'hr', 'manager'), async (req: Request, res: Response) => {
  const { 
    name, department_id, job_role, basic_salary, salary_per_day, increment_rate, 
    joining_date, phone, email, address, city_id, status,
    referred_by_emp_id, referred_by_name, referred_by_phone, monthly_advance_deduction
  } = req.body;
  try {
    const isManager = req.user?.role === 'manager';

    if (isManager) {
      // Managers cannot alter basic salary, daily rate, or increment rate of existing employees
      await pool.query(
        `UPDATE employees SET 
          name=?, department_id=?, job_role=?,
          joining_date=?, phone=?, email=?, address=?, city_id=?, status=?,
          referred_by_emp_id=?, referred_by_name=?, referred_by_phone=?
        WHERE id=?`,
        [
          name, department_id || null, job_role || null,
          joining_date || null, phone || null, email || null, address || null, city_id || null, status || 'active',
          referred_by_emp_id || null, referred_by_name || null, referred_by_phone || null,
          req.params.id
        ]
      );
      await auditLog(req.user!.id, req.user!.username, 'edit', 'employees', parseInt(req.params.id), null, req.body, null, req);
      return res.json({ success: true, message: 'Employee profile updated (Salary parameters are protected)' });
    }

    // Admin / HR updating full profile including salary terms
    const [existingRows]: any = await pool.query('SELECT basic_salary FROM employees WHERE id = ?', [req.params.id]);
    const prevBasic = existingRows.length ? Number(existingRows[0].basic_salary) : 0;
    const submittedBasic = Number(basic_salary) || 0;
    const today = new Date().toISOString().split('T')[0];
    const isManualSalaryChange = submittedBasic > 0 && Math.abs(submittedBasic - prevBasic) >= 1;

    let updateSql = `UPDATE employees SET 
        name=?, department_id=?, job_role=?, basic_salary=?, salary_per_day=?, increment_rate=?, 
        joining_date=?, phone=?, email=?, address=?, city_id=?, status=?,
        referred_by_emp_id=?, referred_by_name=?, referred_by_phone=?,
        monthly_advance_deduction=?`;
    
    const updateParams: any[] = [
      name, department_id || null, job_role || null, submittedBasic, salary_per_day || 0, 
      increment_rate !== undefined ? increment_rate : 5.0, joining_date || null, 
      phone || null, email || null, address || null, city_id || null, status || 'active',
      referred_by_emp_id || null, referred_by_name || null, referred_by_phone || null,
      monthly_advance_deduction || 0
    ];

    if (isManualSalaryChange) {
      updateSql += `, last_increment_date = ?, initial_basic_salary = ?`;
      updateParams.push(today, submittedBasic);
    }

    updateSql += ` WHERE id=?`;
    updateParams.push(req.params.id);

    await pool.query(updateSql, updateParams);

    if (isManualSalaryChange) {
      const incRate = prevBasic > 0 ? parseFloat((((submittedBasic - prevBasic) / prevBasic) * 100).toFixed(2)) : 0;
      await pool.query(
        `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'manual', 'Manual Salary Edit from Employee Management', ?)`,
        [req.params.id, prevBasic, submittedBasic, incRate, today, req.user!.id]
      );
    }

    await auditLog(req.user!.id, req.user!.username, 'edit', 'employees', parseInt(req.params.id), null, req.body, null, req);
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/employees/:id/status - Quick Toggle Active/Inactive (Accessible by Admin and Manager)
router.patch('/:id/status', authorizeRoles('admin', 'manager', 'hr'), async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'inactive', 'resigned'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }
  try {
    await pool.query('UPDATE employees SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog(req.user!.id, req.user!.username, 'edit', 'employees', parseInt(req.params.id), 'status_change', { status }, null, req);
    res.json({ success: true, message: `Employee status set to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
});

// POST /api/employees/:id/approve-salary - Admin approves manager-submitted salary
router.post('/:id/approve-salary', authorizeRoles('admin'), async (req: Request, res: Response) => {
  const { basic_salary, salary_per_day } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    let query = 'UPDATE employees SET salary_approved = 1, salary_approved_by = ?, last_increment_date = ?';
    const params: any[] = [req.user!.id, today];

    if (basic_salary !== undefined) {
      query += ', basic_salary = ?, salary_per_day = ?, initial_basic_salary = ?';
      const perDay = salary_per_day || parseFloat((Number(basic_salary) / 30).toFixed(2));
      params.push(basic_salary, perDay, basic_salary);
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.query(query, params);
    await auditLog(req.user!.id, req.user!.username, 'approve', 'employees', parseInt(req.params.id), 'salary_approved', { basic_salary }, null, req);
    res.json({ success: true, message: 'Salary approved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error approving salary' });
  }
});

// DELETE /api/employees/:id - Admin only with reason
router.delete('/:id', authorizeRoles('admin'), async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ success: false, message: 'Reason required for deletion' }); return; }
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!rows.length) { res.status(404).json({ success: false, message: 'Employee not found' }); return; }
    await pool.query('UPDATE employees SET status = "resigned" WHERE id = ?', [req.params.id]);
    await auditLog(req.user!.id, req.user!.username, 'delete', 'employees', parseInt(req.params.id), `EMP:${rows[0].emp_code}`, { name: rows[0].name }, reason, req);
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
