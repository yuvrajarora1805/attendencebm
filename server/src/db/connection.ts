import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
});

export async function testConnection(maxRetries = 15, delayMs = 2000): Promise<void> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`📡 Connecting to MySQL database at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306} (attempt ${attempt}/${maxRetries})...`);
      const conn = await pool.getConnection();
      console.log('✅ MySQL connected successfully');
      conn.release();
      return;
    } catch (error: any) {
      console.warn(`⚠️ MySQL connection attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt >= maxRetries) {
        console.error('❌ All MySQL connection attempts exhausted:', error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export default pool;
