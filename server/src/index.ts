import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import { testConnection } from './db/connection';
import { runAutoMigrations } from './db/migrate';
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import attendanceRoutes from './routes/attendance';
import salaryRoutes from './routes/salary';
import dataControlRoutes from './routes/dataControl';
import dashboardRoutes from './routes/dashboard';
import userRoutes from './routes/users';
import advanceRoutes from './routes/advances';
import reportRoutes from './routes/reports';
import backupRoutes from './routes/backup';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000');

// ── Security Middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, validate: { default: false } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many login attempts', validate: { default: false } });
const punchLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30, message: 'Too many punch requests', validate: { default: false } });

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Trust proxy (for VPS deployment) ──────────────────────────
app.set('trust proxy', 1);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', punchLimiter, attendanceRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/data-control', dataControlRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/advances', advanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date(), version: '1.0.0' });
});

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Error Handler ──────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start Server ───────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    await runAutoMigrations();
    app.listen(PORT, () => {
      console.log(`\n🚀 Attendance Management Server running on port ${PORT}`);
      console.log(`   Main API:    http://localhost:${PORT}/api`);
      console.log(`   Health:      http://localhost:${PORT}/health`);
      console.log(`   Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`   Guard UI:    ${process.env.GUARD_FRONTEND_URL || 'http://localhost:5174'}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
