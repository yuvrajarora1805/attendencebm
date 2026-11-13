import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import pool from './db/connection';

dotenv.config();

const app = express();
const GUARD_PORT = parseInt(process.env.GUARD_PORT || '5051');

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Quick health check
app.get('/health', (req, res) => {
  res.json({ service: 'Guard Terminal Service', status: 'ok', port: GUARD_PORT, time: new Date() });
});

// GET /api/today - Live punches for guard screen
app.get('/api/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.query<any[]>(
      `SELECT ar.*, e.name, e.emp_code, d.name as department_name 
       FROM attendance_records ar
       JOIN employees e ON ar.emp_id = e.id 
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE ar.date = ? AND ar.is_archived = 0 
       ORDER BY ar.punch_in DESC LIMIT 50`,
      [today]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Guard service fetch error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/punch - Auto In/Out punch terminal
app.post('/api/punch', async (req, res) => {
  const { emp_code, action = 'auto' } = req.body;
  if (!emp_code) {
    return res.status(400).json({ success: false, message: 'emp_code is required' });
  }

  try {
    const cleanCode = String(emp_code).trim().toUpperCase();
    const [empRows] = await pool.query<any[]>(
      'SELECT * FROM employees WHERE emp_code = ? AND status = "active"',
      [cleanCode]
    );

    if (!empRows.length) {
      return res.status(404).json({ success: false, message: `Employee code "${cleanCode}" not found or inactive` });
    }

    const emp = empRows[0];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const [existingRows] = await pool.query<any[]>(
      'SELECT * FROM attendance_records WHERE emp_id = ? AND date = ?',
      [emp.id, today]
    );
    const existing = existingRows[0];

    let targetAction = action;
    if (action === 'auto') {
      if (existing?.punch_in && !existing?.punch_out) {
        targetAction = 'out';
      } else if (!existing?.punch_in) {
        targetAction = 'in';
      } else {
        return res.status(409).json({
          success: false,
          message: `Already completed both Punch In and Punch Out for today (${today})`,
          data: existing
        });
      }
    }

    if (targetAction === 'in') {
      if (existing?.punch_in) {
        return res.status(409).json({ success: false, message: 'Already punched in today', data: existing });
      }

      // Check schedule for late marking
      const [schedRows] = await pool.query<any[]>('SELECT * FROM work_schedules WHERE is_default = 1 LIMIT 1');
      const sched = schedRows[0];
      let isLate = 0;
      let lateMinutes = 0;

      if (sched) {
        const [h, m] = sched.work_start.split(':').map(Number);
        const schedStart = new Date(now);
        schedStart.setHours(h, m + (sched.late_threshold_minutes || 15), 0, 0);
        if (now > schedStart) {
          isLate = 1;
          lateMinutes = Math.floor((now.getTime() - schedStart.getTime()) / 60000);
        }
      }

      if (existing) {
        await pool.query(
          'UPDATE attendance_records SET punch_in = ?, is_late = ?, late_minutes = ?, status = ? WHERE id = ?',
          [now, isLate, lateMinutes, isLate ? 'late' : 'present', existing.id]
        );
      } else {
        await pool.query(
          'INSERT INTO attendance_records (emp_id, date, punch_in, is_late, late_minutes, status) VALUES (?, ?, ?, ?, ?, ?)',
          [emp.id, today, now, isLate, lateMinutes, isLate ? 'late' : 'present']
        );
      }

      return res.json({
        success: true,
        action: 'in',
        message: `Punch IN verified${isLate ? ' (Late by ' + lateMinutes + 'm)' : ''}`,
        emp_name: emp.name,
        time: now,
        is_late: isLate === 1,
        late_minutes: lateMinutes
      });
    } else if (targetAction === 'out') {
      if (!existing?.punch_in) {
        return res.status(400).json({ success: false, message: 'No punch-in recorded today for this employee' });
      }
      if (existing.punch_out) {
        return res.status(409).json({ success: false, message: 'Already punched out today' });
      }

      let overtimeHours = 0;
      const [schedRows] = await pool.query<any[]>('SELECT * FROM work_schedules WHERE is_default = 1 LIMIT 1');
      const sched = schedRows[0];
      if (sched) {
        const [h, m] = sched.work_end.split(':').map(Number);
        const schedEnd = new Date(now);
        schedEnd.setHours(h, m, 0, 0);
        if (now > schedEnd) {
          overtimeHours = parseFloat(((now.getTime() - schedEnd.getTime()) / 3600000).toFixed(2));
        }
      }

      await pool.query(
        'UPDATE attendance_records SET punch_out = ?, overtime_hours = ? WHERE id = ?',
        [now, overtimeHours, existing.id]
      );

      return res.json({
        success: true,
        action: 'out',
        message: `Punch OUT verified${overtimeHours > 0 ? ' (OT: ' + overtimeHours + 'h)' : ''}`,
        emp_name: emp.name,
        time: now,
        overtime_hours: overtimeHours
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (err: any) {
    console.error('Guard punch error:', err);
    res.status(500).json({ success: false, message: 'Server error processing punch' });
  }
});

// Standalone Web UI directly served on port 5174 or fallback
app.get('*', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AttendPro Guard Terminal (Port ${GUARD_PORT})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --accent-blue: #0284c7;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --border: #1f2937;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px 16px; }
    .header { width: 100%; max-width: 1000px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .title-group { display: flex; align-items: center; gap: 12px; }
    .logo-badge { width: 44px; height: 44px; background: linear-gradient(135deg, #0284c7, #2563eb); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; box-shadow: 0 4px 14px rgba(2,132,199,0.4); }
    .port-pill { font-size: 11px; background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 4px 10px; border-radius: 999px; font-weight: 700; letter-spacing: 0.05em; }
    .container { width: 100%; max-width: 1000px; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; }
    @media(max-width: 800px) { .container { grid-template-columns: 1fr; } }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .clock-display { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; text-align: center; color: #fff; text-shadow: 0 0 20px rgba(2,132,199,0.3); line-height: 1.1; margin-bottom: 6px; }
    .date-display { text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 24px; }
    .mode-selector { display: flex; background: #0b1120; border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 20px; gap: 4px; }
    .mode-btn { flex: 1; padding: 10px 6px; font-size: 13px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; color: var(--text-muted); background: transparent; transition: all 0.2s; }
    .mode-btn.active-auto { background: #0284c7; color: #fff; }
    .mode-btn.active-in { background: #10b981; color: #fff; }
    .mode-btn.active-out { background: #3b82f6; color: #fff; }
    .input-label { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px; }
    .emp-input { width: 100%; font-size: 28px; font-weight: 800; letter-spacing: 0.05em; text-align: center; padding: 16px; border-radius: 12px; border: 2px solid var(--border); background: #0b1120; color: #fff; outline: none; transition: border-color 0.2s; }
    .emp-input:focus { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2,132,199,0.25); }
    .punch-button { width: 100%; margin-top: 18px; padding: 16px; border-radius: 12px; border: none; font-size: 16px; font-weight: 800; cursor: pointer; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; transition: opacity 0.2s, transform 0.1s; box-shadow: 0 6px 20px rgba(2,132,199,0.35); }
    .punch-button:active { transform: scale(0.99); }
    .result-banner { margin-top: 18px; padding: 14px 18px; border-radius: 10px; font-size: 14px; font-weight: 700; text-align: center; animation: fadeIn 0.3s ease; }
    .result-success { background: rgba(16,185,129,0.15); border: 1.5px solid rgba(16,185,129,0.4); color: #34d399; }
    .result-error { background: rgba(239,68,68,0.15); border: 1.5px solid rgba(239,68,68,0.4); color: #f87171; }
    .live-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .live-list { max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .punch-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #0b1120; border: 1px solid var(--border); border-radius: 8px; }
    .badge-in { background: rgba(16,185,129,0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
    .badge-out { background: rgba(59,130,246,0.2); color: #60a5fa; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <div class="logo-badge">🛡️</div>
      <div>
        <h2 style="font-size: 18px; font-weight: 800;">AttendPro Guard Terminal Microservice</h2>
        <p style="font-size: 12px; color: var(--text-muted);">Independent Gate Attendance Service</p>
      </div>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span class="port-pill">PORT :${GUARD_PORT}</span>
      <a href="http://localhost:5173" style="font-size: 12px; color: #0284c7; text-decoration: none; font-weight: 700;">Admin/Manager Portal (:5173) ↗</a>
    </div>
  </div>

  <div class="container">
    <div class="card">
      <div id="clock" class="clock-display">00:00:00</div>
      <div id="date" class="date-display">Loading date...</div>

      <div class="mode-selector">
        <button id="btn-auto" class="mode-btn active-auto" onclick="setMode('auto')">⚡ AUTO (IN/OUT)</button>
        <button id="btn-in" class="mode-btn" onclick="setMode('in')">🟢 PUNCH IN</button>
        <button id="btn-out" class="mode-btn" onclick="setMode('out')">🔵 PUNCH OUT</button>
      </div>

      <label class="input-label">Scan Barcode or Enter Employee Code</label>
      <input id="emp-input" class="emp-input" type="text" placeholder="e.g. 18028" autofocus autocomplete="off" />
      <button id="punch-btn" class="punch-button" onclick="handlePunch()">⚡ VERIFY & PUNCH</button>

      <div id="result-box" style="display:none;"></div>
    </div>

    <div class="card">
      <div class="live-list-header">
        <div style="font-size: 15px; font-weight: 800;">Today's Gate Punches</div>
        <span class="port-pill" style="background: rgba(2,132,199,0.15); color: #38bdf8; border-color: rgba(2,132,199,0.3);">LIVE POLLING</span>
      </div>
      <div id="live-list" class="live-list">
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">Connecting to database...</div>
      </div>
    </div>
  </div>

  <script>
    let currentMode = 'auto';
    const inputEl = document.getElementById('emp-input');
    const resultBox = document.getElementById('result-box');
    const liveList = document.getElementById('live-list');

    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString('en-GB');
      document.getElementById('date').textContent = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    function setMode(mode) {
      currentMode = mode;
      document.getElementById('btn-auto').className = 'mode-btn ' + (mode === 'auto' ? 'active-auto' : '');
      document.getElementById('btn-in').className = 'mode-btn ' + (mode === 'in' ? 'active-in' : '');
      document.getElementById('btn-out').className = 'mode-btn ' + (mode === 'out' ? 'active-out' : '');
      inputEl.focus();
    }

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handlePunch();
    });

    async function handlePunch() {
      const code = inputEl.value.trim().toUpperCase();
      if (!code) return;

      const punchBtn = document.getElementById('punch-btn');
      punchBtn.disabled = true;
      punchBtn.textContent = '⏳ Processing...';

      try {
        const res = await fetch('/api/punch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emp_code: code, action: currentMode })
        });
        const data = await res.json();

        resultBox.style.display = 'block';
        if (data.success) {
          resultBox.className = 'result-banner result-success';
          resultBox.innerHTML = '✅ ' + data.emp_name + ' &bull; ' + data.message;
          inputEl.value = '';
          fetchToday();
        } else {
          resultBox.className = 'result-banner result-error';
          resultBox.innerHTML = '❌ ' + (data.message || 'Punch failed');
        }
      } catch (err) {
        resultBox.style.display = 'block';
        resultBox.className = 'result-banner result-error';
        resultBox.innerHTML = '⚠️ Service connection error. Check server.';
      } finally {
        punchBtn.disabled = false;
        punchBtn.textContent = '⚡ VERIFY & PUNCH';
        inputEl.focus();
        setTimeout(() => { resultBox.style.display = 'none'; }, 6000);
      }
    }

    async function fetchToday() {
      try {
        const res = await fetch('/api/today');
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          liveList.innerHTML = json.data.map(item => \`
            <div class="punch-row">
              <div>
                <div style="font-weight: 700; font-size: 13px;">\${item.name}</div>
                <div style="font-size: 11px; color: var(--text-muted);">\${item.emp_code} \${item.department_name ? '&bull; ' + item.department_name : ''}</div>
              </div>
              <div style="text-align: right;">
                <span class="\${item.punch_out ? 'badge-out' : 'badge-in'}">\${item.punch_out ? 'OUT' : 'IN'}</span>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">
                  \${new Date(item.punch_out || item.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          \`).join('');
        } else {
          liveList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No punches yet today.</div>';
        }
      } catch (e) {}
    }

    fetchToday();
    setInterval(fetchToday, 10000);
  </script>
</body>
</html>`);
});

app.listen(GUARD_PORT, () => {
  console.log(`\n🛡️ Guard Microservice running on port ${GUARD_PORT}`);
  console.log(`   Gate Terminal URL: http://localhost:${GUARD_PORT}\n`);
});
