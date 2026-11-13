import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pool from './connection';

async function syncFromMDB() {
  const mdbPath = '/media/yuvraj/New Volume/xamp/htdocs/attendance/database/db1.MDB';
  if (!fs.existsSync(mdbPath)) {
    console.error('❌ MDB file not found at:', mdbPath);
    process.exit(1);
  }

  console.log('🔄 Starting full sync from db1.MDB into AttendPro...');

  // 1. Export MDB tables to CSV in temporary folder
  const tmpDir = path.resolve(__dirname, '../../tmp_mdb');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  console.log('📦 Exporting tables from MDB to CSV...');
  execSync(`mdb-export "${mdbPath}" DepMaster > "${tmpDir}/DepMaster.csv"`);
  execSync(`mdb-export "${mdbPath}" AccMaster > "${tmpDir}/AccMaster.csv"`);
  execSync(`mdb-export "${mdbPath}" SalaryIncrement > "${tmpDir}/SalaryIncrement.csv"`);
  execSync(`mdb-export "${mdbPath}" Transections > "${tmpDir}/Transections.csv"`);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log('🧹 Purging existing operational data (preserving admin users & work schedules)...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE advance_transactions');
    await connection.query('TRUNCATE TABLE salary_entries');
    await connection.query('TRUNCATE TABLE salary_increments');
    await connection.query('TRUNCATE TABLE attendance_records');
    await connection.query('TRUNCATE TABLE employees');
    await connection.query('TRUNCATE TABLE departments');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Import Departments
    console.log('📥 Importing Departments...');
    const depCsv = fs.readFileSync(`${tmpDir}/DepMaster.csv`, 'utf8').trim().split('\n');
    const depMap = new Map<number, number>(); // old DepCode -> new id

    for (let i = 1; i < depCsv.length; i++) {
      const line = depCsv[i].trim();
      if (!line) continue;
      const match = line.match(/^(\d+),"(.*?)"/);
      if (match) {
        const depCode = parseInt(match[1]);
        const depName = match[2].trim();
        const [res]: any = await connection.query(
          'INSERT INTO departments (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
          [depName]
        );
        depMap.set(depCode, res.insertId);
      }
    }
    console.log(`✅ Imported ${depMap.size} departments`);

    // 3. Import Employees
    console.log('📥 Importing Employees from AccMaster (1,571 records)...');
    const accLines = fs.readFileSync(`${tmpDir}/AccMaster.csv`, 'utf8').trim().split('\n');
    const empCodeToId = new Map<number, number>();
    let empCount = 0;

    for (let i = 1; i < accLines.length; i++) {
      const line = accLines[i];
      if (!line) continue;
      
      const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (row.length < 17) continue;

      const aCode = parseInt(row[0]);
      const aName = row[1]?.replace(/^"|"$/g, '').trim();
      const aSF = row[6]?.replace(/^"|"$/g, '').trim() || String(aCode).padStart(4, '0');
      const depCode = parseInt(row[12]) || 0;
      const jDateRaw = row[14]?.replace(/^"|"$/g, '').trim();
      const basicSalary = parseFloat(row[15]) || 0;
      const jobStatus = row[16]?.replace(/^"|"$/g, '').trim().toUpperCase();

      let joiningDate: string | null = null;
      if (jDateRaw) {
        const d = new Date(jDateRaw);
        if (!isNaN(d.getTime())) joiningDate = d.toISOString().split('T')[0];
      }

      const status = jobStatus === 'ACTIVE' ? 'active' : 'resigned';
      const newDepId = depMap.get(depCode) || null;
      const salaryPerDay = parseFloat((basicSalary / 30).toFixed(2));

      const [res]: any = await connection.query(
        `INSERT INTO employees (emp_code, name, department_id, job_role, basic_salary, initial_basic_salary, salary_per_day, increment_rate, joining_date, status)
         VALUES (?, ?, ?, 'Staff', ?, ?, ?, 5.0, ?, ?)`,
        [aSF, aName, newDepId, basicSalary, basicSalary, salaryPerDay, joiningDate, status]
      );

      empCodeToId.set(aCode, res.insertId);
      empCount++;
    }
    console.log(`✅ Imported ${empCount} employees`);

    // 4. Import Advances from Transections
    console.log('📥 Importing Advances Ledger...');
    const transLines = fs.readFileSync(`${tmpDir}/Transections.csv`, 'utf8').trim().split('\n');
    let advCount = 0;

    for (let i = 1; i < transLines.length; i++) {
      const line = transLines[i];
      if (!line) continue;
      const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (row.length < 8) continue;

      const aCode = parseInt(row[0]);
      const empId = empCodeToId.get(aCode);
      if (!empId) continue;

      const amount = Math.abs(parseFloat(row[1]) || 0);
      if (amount === 0) continue;

      const statusStr = row[2]?.replace(/^"|"$/g, '').trim().toLowerCase();
      const type = (statusStr === 'debit') ? 'given' : 'deduction';
      const narration = row[3]?.replace(/^"|"$/g, '').trim();
      const tDateRaw = row[7]?.replace(/^"|"$/g, '').trim();

      let tDate = new Date().toISOString().split('T')[0];
      if (tDateRaw) {
        const d = new Date(tDateRaw);
        if (!isNaN(d.getTime())) tDate = d.toISOString().split('T')[0];
      }

      await connection.query(
        `INSERT INTO advance_transactions (emp_id, date, type, amount, remarks, mode)
         VALUES (?, ?, ?, ?, ?, 'cash')`,
        [empId, tDate, type, amount, narration || (type === 'given' ? 'Advance Disbursed' : 'Salary Advance Deduction')]
      );
      advCount++;
    }
    console.log(`✅ Imported ${advCount} advance ledger transactions`);

    // 5. Import Salary Increments
    console.log('📥 Importing Salary Increments...');
    const incLines = fs.readFileSync(`${tmpDir}/SalaryIncrement.csv`, 'utf8').trim().split('\n');
    let incCount = 0;

    for (let i = 1; i < incLines.length; i++) {
      const line = incLines[i];
      if (!line) continue;
      const row = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (row.length < 5) continue;

      const aCode = parseInt(row[1]);
      const empId = empCodeToId.get(aCode);
      if (!empId) continue;

      const vDateRaw = row[2]?.replace(/^"|"$/g, '').trim();
      const oldBasic = parseFloat(row[3]) || 0;
      const newBasic = parseFloat(row[4]) || 0;
      let effDate = new Date().toISOString().split('T')[0];
      if (vDateRaw) {
        const d = new Date(vDateRaw);
        if (!isNaN(d.getTime())) effDate = d.toISOString().split('T')[0];
      }

      const percent = oldBasic > 0 ? parseFloat((((newBasic - oldBasic) / oldBasic) * 100).toFixed(2)) : 5.0;

      await connection.query(
        `INSERT INTO salary_increments (emp_id, old_basic, new_basic, increment_percent, effective_date, type, notes)
         VALUES (?, ?, ?, ?, ?, 'legacy_increment', 'Imported from legacy MDB database')`,
        [empId, oldBasic, newBasic, percent, effDate]
      );
      incCount++;
    }
    console.log(`✅ Imported ${incCount} salary increments`);

    await connection.commit();
    console.log('🎉 Full sync from db1.MDB completed successfully!');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Sync failed, transaction rolled back:', err);
  } finally {
    connection.release();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

syncFromMDB().then(() => process.exit(0)).catch(() => process.exit(1));

