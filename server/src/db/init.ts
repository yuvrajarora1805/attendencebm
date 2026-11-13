import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function initDatabase(): Promise<void> {
  console.log('🔄 Initializing database...');

  const dbName = process.env.DB_NAME || 'attendance_db';
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    // 1. Create DB if not exists
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await rootConn.query(`USE \`${dbName}\``);

    const schemaPath = path.join(__dirname, 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove line comments (-- ...)
    schema = schema.replace(/--.*$/gm, '');

    // Split statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toLowerCase().startsWith('create database') && !s.toLowerCase().startsWith('use '));

    for (const stmt of statements) {
      try {
        await rootConn.query(stmt);
      } catch (err: any) {
        if (!err.message?.includes('Duplicate entry') && !err.message?.includes('already exists')) {
          console.warn('⚠️  Statement warning:', err.message);
        }
      }
    }

    // Seed/Update admin and guard with valid bcrypt hash for 'admin123'
    const passwordHash = await bcrypt.hash('admin123', 10);
    const managerPasswordHash = await bcrypt.hash('manager123', 10);

    await rootConn.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ('admin', ?, 'System Administrator', 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [passwordHash]
    );
    await rootConn.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ('guard', ?, 'Main Gate Guard', 'security_guard')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [passwordHash]
    );
    await rootConn.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ('manager', ?, 'Floor Shift Manager', 'manager')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [managerPasswordHash]
    );

    console.log('✅ Database initialized successfully!');
    console.log('📋 Tables created in database:', dbName);
    console.log('\n🔑 Default credentials:');
    console.log('   Admin   → username: admin   | password: admin123');
    console.log('   Manager → username: manager | password: manager123');
    console.log('   Guard   → username: guard   | password: admin123\n');
  } finally {
    await rootConn.end();
  }
}

initDatabase().catch(err => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
