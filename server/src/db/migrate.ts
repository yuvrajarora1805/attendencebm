import pool from './connection';
import bcrypt from 'bcryptjs';

export async function runAutoMigrations(): Promise<void> {
  try {
    // 1. Add employee reference, approval, and installment deduction columns
    const columnsToAdd = [
      { col: 'referred_by_emp_id', type: 'INT NULL' },
      { col: 'referred_by_name', type: 'VARCHAR(150) NULL' },
      { col: 'referred_by_phone', type: 'VARCHAR(20) NULL' },
      { col: 'salary_approved', type: 'TINYINT(1) DEFAULT 1' },
      { col: 'salary_approved_by', type: 'INT NULL' },
      { col: 'monthly_advance_deduction', type: 'DECIMAL(10,2) DEFAULT 0.00' },
      { col: 'initial_basic_salary', type: 'DECIMAL(12,2) NULL' },
      { col: 'last_increment_date', type: 'DATE NULL' },
    ];

    for (const item of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE employees ADD COLUMN ${item.col} ${item.type}`);
        console.log(`✅ Added column ${item.col} to employees table`);
      } catch (err: any) {
        // Ignore ER_DUP_FIELDNAME (Duplicate column name)
        if (err.code !== 'ER_DUP_FIELDNAME' && !err.message?.includes('Duplicate column')) {
          console.warn(`Note on migration (${item.col}):`, err.message);
        }
      }
    }

    // 2. Expand users table role ENUM to support 'manager', 'guard', 'payroll'
    try {
      await pool.query(`
        ALTER TABLE users MODIFY COLUMN role 
        ENUM('admin','hr','payroll_operator','payroll_approver','viewer','security_guard','guard','manager','payroll') 
        NOT NULL DEFAULT 'viewer'
      `);
    } catch (err: any) {
      console.warn('Note on users role ENUM migration:', err.message);
    }

    // 3. Ensure default system users (karan [super admin], guard, manager) exist with verified valid passwords
    try {
      const defaultUsers = [
        { username: 'karan', password: 'arora@karan147', full_name: 'Super Administrator', role: 'admin' },
        { username: 'guard', password: 'admin123', full_name: 'Security Guard', role: 'security_guard' },
        { username: 'manager', password: 'manager123', full_name: 'Floor Shift Manager', role: 'manager' },
      ];

      for (const u of defaultUsers) {
        const [rows]: any = await pool.query('SELECT id, password_hash FROM users WHERE username = ?', [u.username]);
        if (!rows || rows.length === 0) {
          const hash = await bcrypt.hash(u.password, 10);
          await pool.query(
            'INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
            [u.username, hash, u.full_name, u.role]
          );
          console.log(`✅ Created default user: ${u.username} (password: ${u.password})`);
        } else {
          // If stored hash doesn't match default password (e.g. initial placeholder mock hash), repair it
          const isMatch = await bcrypt.compare(u.password, rows[0].password_hash).catch(() => false);
          if (!isMatch) {
            const newHash = await bcrypt.hash(u.password, 10);
            await pool.query('UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?', [newHash, rows[0].id]);
            console.log(`🔑 Repaired valid password hash for user: ${u.username} (password: ${u.password})`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Note on verifying default users:', err.message);
    }

    // 4. Add salary periods release tracking & itemized remarks columns
    try {
      await pool.query(`ALTER TABLE salary_periods ADD COLUMN is_released TINYINT(1) DEFAULT 0`);
    } catch (e: any) {}
    try {
      await pool.query(`ALTER TABLE salary_periods ADD COLUMN released_at DATETIME NULL`);
    } catch (e: any) {}
    try {
      await pool.query(`ALTER TABLE salary_entries ADD COLUMN incentive_remarks VARCHAR(255) NULL`);
    } catch (e: any) {}
    try {
      await pool.query(`ALTER TABLE salary_entries ADD COLUMN deduction_remarks VARCHAR(255) NULL`);
    } catch (e: any) {}
    try {
      await pool.query(`ALTER TABLE salary_entries ADD COLUMN allowed_leaves_credit DECIMAL(6,2) DEFAULT 0.00`);
    } catch (e: any) {}
    try {
      await pool.query(`ALTER TABLE salary_entries ADD COLUMN allowed_leaves_bonus DECIMAL(10,2) DEFAULT 0.00`);
    } catch (e: any) {}

    // 5. Create advance_requests table for Manager request & Admin approval workflow
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS advance_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          emp_id INT NOT NULL,
          requested_by INT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          reason TEXT NULL,
          mode ENUM('cash','bank','cheque','upi') DEFAULT 'cash',
          status ENUM('pending','approved','rejected') DEFAULT 'pending',
          admin_notes TEXT NULL,
          monthly_deduction DECIMAL(10,2) DEFAULT 0.00,
          reviewed_by INT NULL,
          reviewed_at DATETIME NULL,
          transaction_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_emp (emp_id)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created advance_requests table');
    } catch (e: any) {
      console.warn('Note on advance_requests table migration:', e.message);
    }

    // 6. Ensure salary_increments table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS salary_increments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          emp_id INT NOT NULL,
          old_basic DECIMAL(10,2) NOT NULL,
          new_basic DECIMAL(10,2) NOT NULL,
          increment_percent DECIMAL(5,2) DEFAULT 0.00,
          effective_date DATE NOT NULL,
          type VARCHAR(50) DEFAULT 'manual',
          notes TEXT NULL,
          created_by INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_emp (emp_id),
          INDEX idx_eff_date (effective_date)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created salary_increments table');
    } catch (e: any) {
      console.warn('Note on salary_increments table migration:', e.message);
    }

    // 7. Annual tenure increment cycle:
    // Mark current year (2026) increment cycle as completed because employee baseline salaries
    // are already up to date for this year.
    try {
      const currentYear = new Date().getFullYear();
      const today = new Date().toISOString().split('T')[0];

      await pool.query(`
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES ('annual_increment_cycle_year', ?, 'Year up to which annual increments are completed')
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, [String(currentYear), String(currentYear)]);

      await pool.query(`
        UPDATE employees 
        SET last_increment_date = ?,
            initial_basic_salary = COALESCE(basic_salary, initial_basic_salary)
        WHERE (last_increment_date IS NULL OR YEAR(last_increment_date) < ?)
      `, [today, currentYear]);

      console.log(`✅ Synchronized annual increment cycle for ${currentYear} (increments already completed)`);
    } catch (e: any) {
      console.warn('Note on annual increment cycle migration:', e.message);
    }

    // 8. Ensure audit_logs table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NULL,
          username VARCHAR(50) NULL,
          action VARCHAR(50) NOT NULL,
          module VARCHAR(50) NULL,
          record_id INT NULL,
          record_ref VARCHAR(100) NULL,
          details JSON NULL,
          reason TEXT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent TEXT NULL,
          status ENUM('success','failed') DEFAULT 'success',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_user (user_id),
          INDEX idx_action (action),
          INDEX idx_module (module),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created audit_logs table');
    } catch (e: any) {
      console.warn('Note on audit_logs table migration:', e.message);
    }

    // 9. Ensure data_archives table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS data_archives (
          id INT AUTO_INCREMENT PRIMARY KEY,
          archive_name VARCHAR(200) NOT NULL,
          module ENUM('attendance','salary','employees','advances','all') NOT NULL,
          date_from DATE NULL,
          date_to DATE NULL,
          emp_id INT NULL,
          record_count INT DEFAULT 0,
          file_path VARCHAR(500) NULL,
          file_size_bytes BIGINT DEFAULT 0,
          checksum VARCHAR(64) NULL,
          verified TINYINT(1) DEFAULT 0,
          verified_at DATETIME NULL,
          status ENUM('creating','ready','restored','deleted','corrupted') DEFAULT 'creating',
          restore_notes TEXT NULL,
          created_by INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_module (module),
          INDEX idx_status (status),
          INDEX idx_dates (date_from, date_to)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created data_archives table');
    } catch (e: any) {
      console.warn('Note on data_archives table migration:', e.message);
    }

    // 10. Ensure backup_snapshots table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS backup_snapshots (
          id INT AUTO_INCREMENT PRIMARY KEY,
          snapshot_name VARCHAR(200) NOT NULL,
          type ENUM('full','selective') DEFAULT 'full',
          file_path VARCHAR(500) NULL,
          file_size_bytes BIGINT DEFAULT 0,
          checksum VARCHAR(64) NULL,
          verified TINYINT(1) DEFAULT 0,
          verified_at DATETIME NULL,
          covers_from DATE NULL,
          covers_to DATE NULL,
          notes TEXT NULL,
          status ENUM('creating','ready','failed') DEFAULT 'creating',
          created_by INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_status (status),
          INDEX idx_created (created_at)
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created backup_snapshots table');
    } catch (e: any) {
      console.warn('Note on backup_snapshots table migration:', e.message);
    }

    // 11. Ensure system_settings table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT NULL,
          description TEXT NULL,
          updated_by INT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      console.log('✅ Checked/created system_settings table');
    } catch (e: any) {
      console.warn('Note on system_settings table migration:', e.message);
    }
  } catch (err: any) {
    console.error('Migration check warning:', err.message);
  }
}
