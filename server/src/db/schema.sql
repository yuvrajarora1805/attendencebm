-- ============================================================
-- Attendance Management System - MySQL Schema
-- Version: 1.0.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE attendance_db;

-- ============================================================
-- USERS & ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role ENUM('admin','hr','payroll_operator','payroll_approver','viewer','security_guard','guard','manager','payroll') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) DEFAULT 1,
  last_login DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- ============================================================
-- CITIES & DESIGNATION POSTINGS (from MDB Masters)
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code INT UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_postings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code INT UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  legacy_acode INT NULL,
  emp_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  department_id INT NULL,
  job_role VARCHAR(100) NULL,
  posting_id INT NULL,
  basic_salary DECIMAL(12,2) DEFAULT 0.00,
  salary_per_day DECIMAL(10,2) DEFAULT 0.00,
  opening_balance DECIMAL(12,2) DEFAULT 0.00,
  opening_balance_type ENUM('debit','credit') DEFAULT 'debit',
  joining_date DATE NULL,
  leaving_date DATE NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  address TEXT NULL,
  city_id INT NULL,
  referred_by_emp_id INT NULL,
  referred_by_name VARCHAR(150) NULL,
  referred_by_phone VARCHAR(20) NULL,
  salary_approved TINYINT(1) DEFAULT 1,
  salary_approved_by INT NULL,
  monthly_advance_deduction DECIMAL(10,2) DEFAULT 0.00,
  initial_basic_salary DECIMAL(12,2) NULL,
  last_increment_date DATE NULL,
  status ENUM('active','inactive','resigned') DEFAULT 'active',
  photo_url VARCHAR(255) NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  FOREIGN KEY (posting_id) REFERENCES job_postings(id) ON DELETE SET NULL,
  FOREIGN KEY (referred_by_emp_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (salary_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_emp_code (emp_code),
  INDEX idx_status (status),
  INDEX idx_dept (department_id)
) ENGINE=InnoDB;

-- ============================================================
-- WORK SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  work_start TIME NOT NULL DEFAULT '09:00:00',
  work_end TIME NOT NULL DEFAULT '18:00:00',
  late_threshold_minutes INT DEFAULT 15,
  is_default TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id INT NOT NULL,
  date DATE NOT NULL,
  punch_in DATETIME NULL,
  punch_out DATETIME NULL,
  status ENUM('present','absent','late','half_day','leave','holiday','weekly_off') DEFAULT 'present',
  is_late TINYINT(1) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  overtime_hours DECIMAL(4,2) DEFAULT 0.00,
  break_minutes INT DEFAULT 0,
  is_corrected TINYINT(1) DEFAULT 0,
  correction_reason TEXT NULL,
  corrected_by INT NULL,
  corrected_at DATETIME NULL,
  is_archived TINYINT(1) DEFAULT 0,
  archived_at DATETIME NULL,
  archive_ref VARCHAR(100) NULL,
  punched_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_emp_date (emp_id, date),
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (punched_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_date (date),
  INDEX idx_emp_id (emp_id),
  INDEX idx_status (status),
  INDEX idx_archived (is_archived)
) ENGINE=InnoDB;

-- ============================================================
-- LEAVE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id INT NOT NULL,
  leave_type ENUM('casual','sick','earned','unpaid','maternity','other') DEFAULT 'casual',
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  total_days DECIMAL(4,1) NOT NULL,
  reason TEXT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_emp_id (emp_id),
  INDEX idx_dates (from_date, to_date)
) ENGINE=InnoDB;

-- ============================================================
-- SALARY PERIODS
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_periods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month TINYINT NOT NULL,
  year YEAR NOT NULL,
  from_date DATE NULL,
  to_date DATE NULL,
  group_name VARCHAR(100) NULL,
  status ENUM('draft','finalized','paid') DEFAULT 'draft',
  total_employees INT DEFAULT 0,
  total_payable DECIMAL(14,2) DEFAULT 0.00,
  finalized_by INT NULL,
  finalized_at DATETIME NULL,
  paid_by INT NULL,
  paid_at DATETIME NULL,
  is_locked TINYINT(1) DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_month_year (month, year),
  FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_year (year),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- SALARY ENTRIES (One row per employee per month)
-- ============================================================
CREATE TABLE IF NOT EXISTS salary_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_id INT NOT NULL,
  emp_id INT NOT NULL,
  voucher_no INT NULL,
  voucher_date DATETIME NULL,
  -- Core Salary Fields
  basic_salary DECIMAL(12,2) DEFAULT 0.00,
  salary_per_day DECIMAL(10,2) DEFAULT 0.00,
  working_days INT DEFAULT 0,
  present_days DECIMAL(5,1) DEFAULT 0.0,
  -- Leave Fields
  actual_leaves DECIMAL(5,2) DEFAULT 0.00,
  final_leaves DECIMAL(5,2) DEFAULT 0.00,
  leaves_amount DECIMAL(10,2) DEFAULT 0.00,
  -- Advance Fields
  op_balance DECIMAL(12,2) DEFAULT 0.00,
  advance_given DECIMAL(12,2) DEFAULT 0.00,
  advance_deduction DECIMAL(12,2) DEFAULT 0.00,
  advance_cf DECIMAL(12,2) DEFAULT 0.00,
  -- Salary Calculation
  net_salary DECIMAL(12,2) DEFAULT 0.00,
  other_deduction DECIMAL(12,2) DEFAULT 0.00,
  other_incentives DECIMAL(12,2) DEFAULT 0.00,
  gross_amount DECIMAL(12,2) DEFAULT 0.00,
  -- Payment
  dop DATE NULL,
  payment_date DATE NULL,
  paid TINYINT(1) DEFAULT 0,
  payment_mode ENUM('cash','bank','cheque','upi') NULL,
  narration TEXT NULL,
  -- Meta
  remarks TEXT NULL,
  snapshot_json LONGTEXT NULL COMMENT 'JSON snapshot of all inputs at calculation time',
  calculated_by INT NULL,
  calculated_at DATETIME NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_period_emp (period_id, emp_id),
  FOREIGN KEY (period_id) REFERENCES salary_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_period (period_id),
  INDEX idx_emp (emp_id),
  INDEX idx_paid (paid)
) ENGINE=InnoDB;

-- ============================================================
-- ADVANCE TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS advance_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emp_id INT NOT NULL,
  date DATE NOT NULL,
  type ENUM('given','deduction') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  period_id INT NULL,
  source_flag VARCHAR(50) DEFAULT 'SALARYPAYMENT',
  voucher_ref INT NULL,
  mode ENUM('cash','bank','cheque','upi') NULL,
  remarks TEXT NULL,
  monthly_deduction DECIMAL(10,2) DEFAULT 0.00,
  recovered_amount DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('active','completed') DEFAULT 'active',
  parent_advance_id INT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (period_id) REFERENCES salary_periods(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_emp_id (emp_id),
  INDEX idx_date (date),
  INDEX idx_type (type)
) ENGINE=InnoDB;

-- ============================================================
-- ADVANCE REQUESTS (Manager requests pending Admin approval)
-- ============================================================
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
  FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES advance_transactions(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_emp (emp_id)
) ENGINE=InnoDB;

-- ============================================================
-- DATA ARCHIVES (records before deletion)
-- ============================================================
CREATE TABLE IF NOT EXISTS data_archives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  archive_name VARCHAR(200) NOT NULL,
  module ENUM('attendance','salary','employees','advances','all') NOT NULL,
  date_from DATE NULL,
  date_to DATE NULL,
  emp_id INT NULL COMMENT 'NULL = all employees',
  record_count INT DEFAULT 0,
  file_path VARCHAR(500) NULL,
  file_size_bytes BIGINT DEFAULT 0,
  checksum VARCHAR(64) NULL COMMENT 'SHA-256 hash of archive file',
  verified TINYINT(1) DEFAULT 0,
  verified_at DATETIME NULL,
  status ENUM('creating','ready','restored','deleted','corrupted') DEFAULT 'creating',
  restore_notes TEXT NULL,
  monthly_deduction DECIMAL(10,2) DEFAULT 0.00,
  recovered_amount DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('active','completed') DEFAULT 'active',
  parent_advance_id INT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_module (module),
  INDEX idx_status (status),
  INDEX idx_dates (date_from, date_to)
) ENGINE=InnoDB;

-- ============================================================
-- BACKUP SNAPSHOTS (full DB backups)
-- ============================================================
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
  monthly_deduction DECIMAL(10,2) DEFAULT 0.00,
  recovered_amount DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('active','completed') DEFAULT 'active',
  parent_advance_id INT NULL,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(50) NULL COMMENT 'Snapshot in case user is deleted',
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50) NULL,
  record_id INT NULL,
  record_ref VARCHAR(100) NULL COMMENT 'Human-readable reference',
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
) ENGINE=InnoDB;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NULL,
  description TEXT NULL,
  updated_by INT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SEED: Super Admin & Default Users (karan: arora@karan147)
-- ============================================================
INSERT IGNORE INTO users (username, password_hash, full_name, role) VALUES
('karan', '$2a$10$ey44U.DSMfpEOznEnY/1E./kS3OlAU/M5E.QvZioImC2iB3S2Foa6', 'Super Administrator', 'admin'),
('admin', '$2a$10$pWmRhqBvX53LLojHWhhobusxTKSg/SHWiVV4w./Dve3u/lCwNt2DC', 'System Administrator', 'admin'),
('guard', '$2a$10$pWmRhqBvX53LLojHWhhobusxTKSg/SHWiVV4w./Dve3u/lCwNt2DC', 'Security Guard', 'security_guard');

-- ============================================================
-- SEED: Default Departments
-- ============================================================
INSERT IGNORE INTO departments (name) VALUES
('Management'),('Administration'),('Production'),('Sales'),('Accounts'),('Security'),('Maintenance');

-- ============================================================
-- SEED: Default Work Schedule
-- ============================================================
INSERT IGNORE INTO work_schedules (name, work_start, work_end, late_threshold_minutes, is_default) VALUES
('Standard (9 AM - 6 PM)', '09:00:00', '18:00:00', 15, 1);

-- ============================================================
-- SEED: System Settings
-- ============================================================
INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'Your Company Name', 'Company name shown on reports'),
('company_address', 'Company Address', 'Company address on payslips'),
('work_days_per_month', '26', 'Standard working days per month'),
('overtime_rate_multiplier', '1.5', 'Overtime pay multiplier'),
('backup_dir', './backups', 'Local backup directory'),
('salary_formula', 'standard', 'Salary calculation formula type'),
('currency_symbol', '₹', 'Currency symbol for display');
