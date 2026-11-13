import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import pool from './connection';

async function seedFromExcel() {
  console.log('📊 Starting Excel Data Import...');
  const excelPath = path.resolve(__dirname, '../../../Aug25_extracted.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error('❌ Excel file not found at:', excelPath);
    process.exit(1);
  }

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets["Aug'2025"];
  if (!ws) {
    console.error("❌ Sheet \"Aug'2025\" not found in workbook!");
    process.exit(1);
  }

  const rows: any[] = XLSX.utils.sheet_to_json(ws);
  console.log(`📋 Read ${rows.length} raw rows from Excel sheet.`);

  // 1. Filter out headers or invalid rows
  const validRows = rows.filter(r =>
    r.Code &&
    r['Employee Name'] &&
    String(r.Code).toLowerCase() !== 'code' &&
    String(r['Employee Name']).toLowerCase() !== 'employee name'
  );

  console.log(`✅ Filtered to ${validRows.length} valid employee records.`);

  // 2. Extract and insert unique departments
  const deptMap = new Map<string, number>();
  for (const r of validRows) {
    const deptName = String(r.Dept || 'GENERAL').trim();
    if (!deptMap.has(deptName)) {
      const [res]: any = await pool.query(
        'INSERT INTO departments (name) VALUES (?) ON DUPLICATE KEY UPDATE name=name',
        [deptName]
      );
      const [deptRow]: any = await pool.query('SELECT id FROM departments WHERE name = ?', [deptName]);
      deptMap.set(deptName, deptRow[0].id);
    }
  }
  console.log(`🏢 Created/Linked ${deptMap.size} departments.`);

  // 3. Insert or update employees
  const empMap = new Map<string, number>();
  for (const r of validRows) {
    const empCode = String(r.Code).trim();
    const name = String(r['Employee Name']).trim();
    const deptId = deptMap.get(String(r.Dept || 'GENERAL').trim()) || null;
    const basic = parseFloat(r.Basic) || 0;
    const perDay = basic > 0 ? parseFloat((basic / 30).toFixed(2)) : 0;

    await pool.query(
      `INSERT INTO employees (emp_code, name, department_id, basic_salary, salary_per_day, status)
       VALUES (?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE name=VALUES(name), department_id=VALUES(department_id),
       basic_salary=VALUES(basic_salary), salary_per_day=VALUES(salary_per_day), status='active'`,
      [empCode, name, deptId, basic, perDay]
    );

    const [empRow]: any = await pool.query('SELECT id FROM employees WHERE emp_code = ?', [empCode]);
    empMap.set(empCode, empRow[0].id);
  }
  console.log(`👥 Upserted ${empMap.size} employee profiles.`);

  // 4. Create or fetch August 2025 Salary Period
  const month = 8;
  const year = 2025;
  await pool.query(
    `INSERT INTO salary_periods (month, year, status, is_locked, notes)
     VALUES (?, ?, 'draft', 0, 'Imported from Aug25_extracted.xlsx')
     ON DUPLICATE KEY UPDATE status=VALUES(status)`,
    [month, year]
  );
  const [periodRow]: any = await pool.query('SELECT id FROM salary_periods WHERE month=? AND year=?', [month, year]);
  const periodId = periodRow[0].id;
  console.log(`📅 Linked August 2025 Salary Period (ID: ${periodId}).`);

  // 5. Insert salary entries
  let totalPayable = 0;
  for (const r of validRows) {
    const empCode = String(r.Code).trim();
    const empId = empMap.get(empCode);
    if (!empId) continue;

    const basic = parseFloat(r.Basic) || 0;
    const perDay = basic > 0 ? parseFloat((basic / 30).toFixed(2)) : 0;
    const al = parseFloat(r.AL) || 0;
    const fl = parseFloat(r.FL) || 0;
    const la = parseFloat(r.LA) || 0;
    const opBal = parseFloat(r['O/P '] || r['O/P'] || 0);
    const advGiven = parseFloat(r['Adv.'] || 0);
    const advDed = parseFloat(r.Ded || 0);
    const advCf = parseFloat(r['Adv. CF'] || (opBal + advGiven - advDed));
    const netSal = parseFloat((basic - la).toFixed(2));
    const grossPay = parseFloat(r.Sal || Math.max(0, netSal - advDed));
    totalPayable += grossPay;

    await pool.query(
      `INSERT INTO salary_entries
       (period_id, emp_id, basic_salary, salary_per_day, working_days, present_days,
        actual_leaves, final_leaves, leaves_amount, op_balance, advance_given,
        advance_deduction, advance_cf, net_salary, other_deduction, other_incentives,
        gross_amount, paid)
       VALUES (?, ?, ?, ?, 31, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0)
       ON DUPLICATE KEY UPDATE
        basic_salary=VALUES(basic_salary), salary_per_day=VALUES(salary_per_day),
        present_days=VALUES(present_days), actual_leaves=VALUES(actual_leaves),
        final_leaves=VALUES(final_leaves), leaves_amount=VALUES(leaves_amount),
        op_balance=VALUES(op_balance), advance_given=VALUES(advance_given),
        advance_deduction=VALUES(advance_deduction), advance_cf=VALUES(advance_cf),
        net_salary=VALUES(net_salary), gross_amount=VALUES(gross_amount)`,
      [
        periodId, empId, basic, perDay, (31 - al), al, fl, la, opBal,
        advGiven, advDed, advCf, netSal, grossPay
      ]
    );
  }

  // Update total in period
  await pool.query(
    'UPDATE salary_periods SET total_employees = ?, total_payable = ? WHERE id = ?',
    [validRows.length, totalPayable, periodId]
  );
  console.log(`💰 Populated ${validRows.length} salary entries. Total Payable: Rs. ${totalPayable.toLocaleString()}`);

  // 6. Generate sample attendance records for August 2025 dates so monthly attendance is populated
  console.log('⏰ Generating attendance sample records for August 2025...');
  const sampleDates = ['2025-08-01', '2025-08-05', '2025-08-10', '2025-08-15', '2025-08-20', '2025-08-25', '2025-08-30'];
  for (const empCode of Array.from(empMap.keys()).slice(0, 50)) {
    const empId = empMap.get(empCode)!;
    for (const d of sampleDates) {
      await pool.query(
        `INSERT IGNORE INTO attendance_records (emp_id, date, punch_in, punch_out, status, is_late)
         VALUES (?, ?, CONCAT(?, ' 08:55:00'), CONCAT(?, ' 17:35:00'), 'present', 0)`,
        [empId, d, d, d]
      );
    }
  }

  // Also add today's date sample attendance so the Dashboard overview shows activity
  const today = new Date().toISOString().slice(0, 10);
  for (const empCode of Array.from(empMap.keys()).slice(0, 25)) {
    const empId = empMap.get(empCode)!;
    await pool.query(
      `INSERT IGNORE INTO attendance_records (emp_id, date, punch_in, punch_out, status, is_late)
       VALUES (?, ?, CONCAT(?, ' 08:52:00'), NULL, 'present', 0)`,
      [empId, today, today]
    );
  }

  console.log('🎉 Excel data import completed successfully!');
  process.exit(0);
}

seedFromExcel().catch(err => {
  console.error('❌ Excel import failed:', err);
  process.exit(1);
});
