import pool from './connection';

async function purgeData() {
  console.log('🔄 Connecting to MySQL to delete existing records...');
  const conn = await pool.getConnection();
  try {
    console.log('🧹 Purging operational records...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    await conn.query('TRUNCATE TABLE advance_transactions');
    console.log('  ✓ Deleted advance_transactions');

    await conn.query('TRUNCATE TABLE salary_entries');
    console.log('  ✓ Deleted salary_entries');

    await conn.query('TRUNCATE TABLE salary_increments');
    console.log('  ✓ Deleted salary_increments');

    await conn.query('TRUNCATE TABLE attendance_records');
    console.log('  ✓ Deleted attendance_records');

    await conn.query('TRUNCATE TABLE employees');
    console.log('  ✓ Deleted employees');

    await conn.query('TRUNCATE TABLE departments');
    console.log('  ✓ Deleted departments');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ All existing employee records and operational data successfully cleared!');
    console.log('ℹ️ Admin user logins and work schedules are preserved.');
  } catch (err: any) {
    console.error('❌ Error during deletion:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

purgeData();

