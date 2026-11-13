const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mdbPath = '/media/yuvraj/New Volume/xamp/htdocs/attendance/database/db1.MDB';
const outSqlPath = '/media/yuvraj/New Volume/xamp/htdocs/attendance/database/attendpro_historical_sync.sql';
const tmpDir = path.resolve(__dirname, 'tmp_export');

if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${str}'`;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function run() {
  console.log('🚀 [1/7] Exporting MDB tables using mdb-export...');
  const tables = ['CityMaster', 'PostMaster', 'DepMaster', 'AccMaster', 'SalaryIncrement', 'Transections', 'MonthlySalary'];
  for (const t of tables) {
    const csvFile = path.join(tmpDir, `${t}.csv`);
    execSync(`mdb-export "${mdbPath}" "${t}" > "${csvFile}"`);
    console.log(`  ✓ Exported ${t}`);
  }

  const out = fs.createWriteStream(outSqlPath, { encoding: 'utf8' });

  out.write(`-- ========================================================\n`);
  out.write(`-- AttendPro Complete Historical Sync from db1.MDB\n`);
  out.write(`-- Generated: ${new Date().toISOString()}\n`);
  out.write(`-- ========================================================\n\n`);
  out.write(`SET NAMES utf8mb4;\n`);
  out.write(`SET FOREIGN_KEY_CHECKS = 0;\n`);
  out.write(`SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n`);

  // Clear old operational data
  out.write(`-- 1. Reset tables (preserving users and settings)\n`);
  out.write(`TRUNCATE TABLE advance_transactions;\n`);
  out.write(`TRUNCATE TABLE salary_entries;\n`);
  out.write(`TRUNCATE TABLE salary_periods;\n`);
  out.write(`TRUNCATE TABLE salary_increments;\n`);
  out.write(`TRUNCATE TABLE attendance_records;\n`);
  out.write(`TRUNCATE TABLE employees;\n`);
  out.write(`TRUNCATE TABLE departments;\n`);
  out.write(`TRUNCATE TABLE cities;\n`);
  out.write(`TRUNCATE TABLE job_postings;\n\n`);

  // Super admin preservation
  out.write(`-- 2. Preserve Super Administrator & Service Accounts\n`);
  out.write(`INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES\n`);
  out.write(`('karan', '$2a$10$ey44U.DSMfpEOznEnY/1E./kS3OlAU/M5E.QvZioImC2iB3S2Foa6', 'Super Administrator', 'admin', 1)\n`);
  out.write(`ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), is_active=1, role='admin';\n\n`);

  out.write(`INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES\n`);
  out.write(`('guard', '$2a$10$pWmRhqBvX53LLojHWhhobusxTKSg/SHWiVV4w./Dve3u/lCwNt2DC', 'Security Guard', 'security_guard', 1)\n`);
  out.write(`ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), is_active=1;\n\n`);

  out.write(`INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES\n`);
  out.write(`('manager', '$2a$10$KN4PjDzmzO455QHWPFyu6OjzbMcW0/RO1DkqZe5T6pon5v3ZesNAG', 'Floor Shift Manager', 'manager', 1)\n`);
  out.write(`ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), is_active=1;\n\n`);

  out.write(`DELETE FROM users WHERE username = 'admin';\n\n`);

  // 3. Cities
  console.log('📍 [2/7] Processing CityMaster...');
  const cityLines = fs.readFileSync(path.join(tmpDir, 'CityMaster.csv'), 'utf8').trim().split('\n');
  const cityMap = new Map();
  const cityVals = [];
  for (let i = 1; i < cityLines.length; i++) {
    const row = parseCSVLine(cityLines[i]);
    if (!row[0]) continue;
    const code = parseInt(row[0]);
    const name = (row[1] || '').trim();
    cityMap.set(code, code);
    cityVals.push(`(${code}, ${code}, ${sqlEscape(name)})`);
  }
  if (cityVals.length) {
    out.write(`-- Cities\nINSERT INTO cities (id, code, name) VALUES\n${cityVals.join(',\n')};\n\n`);
  }

  // 4. Job Postings
  console.log('🏷️ [3/7] Processing PostMaster...');
  const postLines = fs.readFileSync(path.join(tmpDir, 'PostMaster.csv'), 'utf8').trim().split('\n');
  const postMap = new Map();
  const postNameMap = new Map();
  const postVals = [];
  for (let i = 1; i < postLines.length; i++) {
    const row = parseCSVLine(postLines[i]);
    if (!row[0]) continue;
    const code = parseInt(row[0]);
    const name = (row[1] || '').trim();
    postMap.set(code, code);
    postNameMap.set(code, name);
    postVals.push(`(${code}, ${code}, ${sqlEscape(name)})`);
  }
  if (postVals.length) {
    out.write(`-- Job Postings\nINSERT INTO job_postings (id, code, name) VALUES\n${postVals.join(',\n')};\n\n`);
  }

  // 5. Departments
  console.log('🏢 [4/7] Processing DepMaster...');
  const depLines = fs.readFileSync(path.join(tmpDir, 'DepMaster.csv'), 'utf8').trim().split('\n');
  const depMap = new Map();
  const depVals = [];
  for (let i = 1; i < depLines.length; i++) {
    const row = parseCSVLine(depLines[i]);
    if (!row[0]) continue;
    const code = parseInt(row[0]);
    const name = (row[1] || '').trim();
    depMap.set(code, code);
    depVals.push(`(${code}, ${sqlEscape(name)})`);
  }
  if (depVals.length) {
    out.write(`-- Departments\nINSERT INTO departments (id, name) VALUES\n${depVals.join(',\n')};\n\n`);
  }

  // 6. Employees (AccMaster)
  console.log('👥 [5/7] Processing 1,571 Employees (AccMaster)...');
  const accLines = fs.readFileSync(path.join(tmpDir, 'AccMaster.csv'), 'utf8').trim().split('\n');
  const empIdSet = new Set();
  const empBatches = [];
  let curEmpBatch = [];

  for (let i = 1; i < accLines.length; i++) {
    const row = parseCSVLine(accLines[i]);
    if (row.length < 17 || !row[0]) continue;

    const aCode = parseInt(row[0]);
    const aName = (row[1] || '').trim();
    const aAddress = (row[2] || '').trim() || null;
    const aOpBal = parseFloat(row[3]) || 0;
    const aStatus = (row[4] || '').trim().toLowerCase() === 'credit' ? 'credit' : 'debit';
    const aSF = (row[6] || '').trim() || String(aCode).padStart(4, '0');
    const aPhone = (row[11] || '').trim() || null;
    const depCode = parseInt(row[12]) || null;
    const postCode = parseInt(row[13]) || null;
    const jDateRaw = (row[14] || '').trim();
    const basicSalary = parseFloat(row[15]) || 0;
    const jobStatus = (row[16] || '').trim().toUpperCase();
    const leaveDateRaw = (row[17] || '').trim();
    const ctCode = parseInt(row[18]) || null;

    let joiningDate = null;
    if (jDateRaw) {
      const d = new Date(jDateRaw);
      if (!isNaN(d.getTime())) joiningDate = d.toISOString().split('T')[0];
    }

    let leavingDate = null;
    if (leaveDateRaw) {
      const d = new Date(leaveDateRaw);
      if (!isNaN(d.getTime())) leavingDate = d.toISOString().split('T')[0];
    }

    const status = (jobStatus === 'ACTIVE') ? 'active' : 'resigned';
    const depId = depMap.has(depCode) ? depCode : null;
    const cityId = cityMap.has(ctCode) ? ctCode : null;
    const postId = postMap.has(postCode) ? postCode : null;
    const jobRole = postNameMap.get(postCode) || 'Staff';
    const salaryPerDay = parseFloat((basicSalary / 30).toFixed(2));

    empIdSet.add(aCode);

    curEmpBatch.push(
      `(${aCode}, ${aCode}, ${sqlEscape(aSF)}, ${sqlEscape(aName)}, ${sqlEscape(depId)}, ${sqlEscape(jobRole)}, ${sqlEscape(postId)}, ${basicSalary}, ${basicSalary}, ${salaryPerDay}, ${aOpBal}, ${sqlEscape(aStatus)}, ${sqlEscape(joiningDate)}, ${sqlEscape(leavingDate)}, ${sqlEscape(aPhone)}, ${sqlEscape(aAddress)}, ${sqlEscape(cityId)}, ${sqlEscape(status)})`
    );

    if (curEmpBatch.length >= 500) {
      empBatches.push(curEmpBatch);
      curEmpBatch = [];
    }
  }
  if (curEmpBatch.length) empBatches.push(curEmpBatch);

  out.write(`-- Employees (${empIdSet.size} records)\n`);
  for (const b of empBatches) {
    out.write(`INSERT INTO employees (id, legacy_acode, emp_code, name, department_id, job_role, posting_id, basic_salary, initial_basic_salary, salary_per_day, opening_balance, opening_balance_type, joining_date, leaving_date, phone, address, city_id, status) VALUES\n${b.join(',\n')};\n\n`);
  }

  // 7. Salary Increments
  console.log('📈 [6/7] Processing SalaryIncrement (2,616 rows)...');
  const incLines = fs.readFileSync(path.join(tmpDir, 'SalaryIncrement.csv'), 'utf8').trim().split('\n');
  const incVals = [];
  for (let i = 1; i < incLines.length; i++) {
    const row = parseCSVLine(incLines[i]);
    if (row.length < 5 || !row[0]) continue;
    const aCode = parseInt(row[1]);
    if (!empIdSet.has(aCode)) continue;
    const vDateRaw = (row[2] || '').trim();
    const oldSalary = parseFloat(row[3]) || 0;
    const newSalary = parseFloat(row[4]) || 0;
    let effDate = '2020-01-01';
    if (vDateRaw) {
      const d = new Date(vDateRaw);
      if (!isNaN(d.getTime())) effDate = d.toISOString().split('T')[0];
    }
    const percent = oldSalary > 0 ? parseFloat((((newSalary - oldSalary) / oldSalary) * 100).toFixed(2)) : 0;
    incVals.push(`(${aCode}, ${oldSalary}, ${newSalary}, ${percent}, ${sqlEscape(effDate)}, 'legacy', 'Imported from Access MDB')`);
  }
  if (incVals.length) {
    out.write(`-- Salary Increments (${incVals.length} records)\n`);
    for (let i = 0; i < incVals.length; i += 500) {
      const chunk = incVals.slice(i, i + 500);
      out.write(`INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes) VALUES\n${chunk.join(',\n')};\n\n`);
    }
  }

  // 8. Advances (Transections)
  console.log('💳 [7/7] Processing 82,402 Advance Transactions (Transections)...');
  const transLines = fs.readFileSync(path.join(tmpDir, 'Transections.csv'), 'utf8').trim().split('\n');
  const advVals = [];
  let validAdvCount = 0;

  for (let i = 1; i < transLines.length; i++) {
    const row = parseCSVLine(transLines[i]);
    if (row.length < 8 || !row[0]) continue;

    const aCode = parseInt(row[0]);
    if (!empIdSet.has(aCode)) continue;

    const amount = Math.abs(parseFloat(row[1]) || 0);
    if (amount === 0) continue;

    const statusStr = (row[2] || '').trim().toLowerCase();
    const type = statusStr === 'debit' ? 'given' : 'deduction';
    const narration = (row[3] || '').trim();
    const flag = (row[4] || '').trim() || 'SALARYPAYMENT';
    const voucherRef = parseInt(row[5]) || null;
    const tDateRaw = (row[7] || '').trim();

    let tDate = '2024-01-01';
    if (tDateRaw) {
      const d = new Date(tDateRaw);
      if (!isNaN(d.getTime())) tDate = d.toISOString().split('T')[0];
    }

    const remarks = narration || (type === 'given' ? 'Advance Disbursed' : 'Advance Deduction');

    advVals.push(
      `(${aCode}, ${sqlEscape(tDate)}, ${sqlEscape(type)}, ${amount}, ${sqlEscape(flag)}, ${sqlEscape(voucherRef)}, ${sqlEscape(remarks)}, 'cash')`
    );
    validAdvCount++;
  }

  out.write(`-- Advance Transactions (${validAdvCount} records)\n`);
  for (let i = 0; i < advVals.length; i += 1000) {
    const chunk = advVals.slice(i, i + 1000);
    out.write(`INSERT INTO advance_transactions (emp_id, date, type, amount, source_flag, voucher_ref, remarks, mode) VALUES\n${chunk.join(',\n')};\n\n`);
  }

  // 9. Monthly Salary (MonthlySalary)
  console.log('📑 Processing 27,371 Monthly Payroll entries (MonthlySalary)...');
  const salaryLines = fs.readFileSync(path.join(tmpDir, 'MonthlySalary.csv'), 'utf8').trim().split('\n');
  const monthMap = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };

  const periodMap = new Map();
  let nextPeriodId = 1;
  const periodRows = [];
  const salRows = [];

  for (let i = 1; i < salaryLines.length; i++) {
    const row = parseCSVLine(salaryLines[i]);
    if (row.length < 26 || !row[0]) continue;

    const aCode = parseInt(row[7]);
    if (!empIdSet.has(aCode)) continue;

    const vNo = parseInt(row[0]) || null;
    const vDateRaw = (row[1] || '').trim();
    const monthName = (row[2] || '').toLowerCase().trim();
    const workingDays = parseInt(row[3]) || 30;
    const yearNum = parseInt(row[4]) || 2024;
    const fromDateRaw = (row[5] || '').trim();
    const toDateRaw = (row[6] || '').trim();

    const monthNum = monthMap[monthName] || 1;
    const periodKey = `${yearNum}-${monthNum}`;

    let fromDate = null;
    if (fromDateRaw) { const d = new Date(fromDateRaw); if (!isNaN(d.getTime())) fromDate = d.toISOString().split('T')[0]; }
    let toDate = null;
    if (toDateRaw) { const d = new Date(toDateRaw); if (!isNaN(d.getTime())) toDate = d.toISOString().split('T')[0]; }
    let vDate = null;
    if (vDateRaw) { const d = new Date(vDateRaw); if (!isNaN(d.getTime())) vDate = d.toISOString().slice(0, 19).replace('T', ' '); }

    const ghName = (row[27] || '').trim() || null;

    let periodId = periodMap.get(periodKey);
    if (!periodId) {
      periodId = nextPeriodId++;
      periodMap.set(periodKey, periodId);
      periodRows.push(
        `(${periodId}, ${monthNum}, ${yearNum}, ${sqlEscape(fromDate)}, ${sqlEscape(toDate)}, ${sqlEscape(ghName)}, 'finalized', 1, 1)`
      );
    }

    const basicSalary = parseFloat(row[8]) || 0;
    const salaryPerDay = parseFloat(row[9]) || parseFloat((basicSalary / 30).toFixed(2));
    const actualLeaves = parseFloat(row[11]) || 0;
    const finalLeaves = parseFloat(row[12]) || 0;
    const leavesAmount = parseFloat(row[13]) || 0;
    const otherDeduction = parseFloat(row[14]) || 0;
    const otherIncentives = parseFloat(row[15]) || 0;
    const opBalance = parseFloat(row[16]) || 0;
    const advanceGiven = parseFloat(row[17]) || 0;
    const advanceDeduction = parseFloat(row[18]) || 0;
    const netSalary = parseFloat(row[19]) || 0;
    const advanceCf = parseFloat(row[20]) || 0;
    const payDateRaw = (row[21] || '').trim();
    const narration = (row[23] || '').trim() || null;
    const paid = parseInt(row[24]) === 1 ? 1 : 0;
    const grossAmount = parseFloat(row[25]) || 0;

    let paymentDate = null;
    if (payDateRaw) { const d = new Date(payDateRaw); if (!isNaN(d.getTime())) paymentDate = d.toISOString().split('T')[0]; }

    const presentDays = Math.max(0, workingDays - finalLeaves);

    salRows.push(
      `(${periodId}, ${aCode}, ${sqlEscape(vNo)}, ${sqlEscape(vDate)}, ${basicSalary}, ${salaryPerDay}, ${workingDays}, ${presentDays}, ${actualLeaves}, ${finalLeaves}, ${leavesAmount}, ${opBalance}, ${advanceGiven}, ${advanceDeduction}, ${advanceCf}, ${netSalary}, ${otherDeduction}, ${otherIncentives}, ${grossAmount}, ${sqlEscape(paymentDate)}, ${paid}, ${sqlEscape(narration)})`
    );
  }

  out.write(`-- Salary Periods (${periodRows.length} periods)\n`);
  out.write(`INSERT INTO salary_periods (id, month, year, from_date, to_date, group_name, status, is_locked, is_released) VALUES\n${periodRows.join(',\n')};\n\n`);

  out.write(`-- Salary Entries (${salRows.length} records)\n`);
  for (let i = 0; i < salRows.length; i += 1000) {
    const chunk = salRows.slice(i, i + 1000);
    out.write(`INSERT INTO salary_entries (period_id, emp_id, voucher_no, voucher_date, basic_salary, salary_per_day, working_days, present_days, actual_leaves, final_leaves, leaves_amount, op_balance, advance_given, advance_deduction, advance_cf, net_salary, other_deduction, other_incentives, gross_amount, payment_date, paid, narration) VALUES\n${chunk.join(',\n')};\n\n`);
  }

  out.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  out.end();

  console.log(`\n🎉 Generated SQL file successfully at: ${outSqlPath}`);

  // Clean temp files
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
