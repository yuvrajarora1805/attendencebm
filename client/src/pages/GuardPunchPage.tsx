import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, LogOut, ArrowLeft, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

interface PunchResult {
  type: 'success' | 'error';
  name?: string;
  message: string;
  time?: string;
  action?: 'in' | 'out';
  is_late?: boolean;
  late_minutes?: number;
  overtime_hours?: number;
}

export default function GuardPunchPage() {
  const [empCode, setEmpCode] = useState('');
  const [action, setAction] = useState<'auto' | 'in' | 'out'>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [clock, setClock] = useState(new Date());
  const [todayList, setTodayList] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<string>(() => {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  useEffect(() => {
    const tClock = setInterval(() => setClock(new Date()), 1000);
    fetchToday();
    const tFetch = setInterval(fetchToday, 30000);
    inputRef.current?.focus();
    return () => { clearInterval(tClock); clearInterval(tFetch); };
  }, []);

  const fetchToday = async () => {
    try {
      const res = await api.get('/attendance/today');
      setTodayList(res.data.data?.slice(0, 15) || []);
    } catch {}
  };

  const handlePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/attendance/punch', { emp_code: empCode.trim().toUpperCase(), action });
      setResult({
        type: 'success',
        name: res.data.emp_name,
        message: res.data.message,
        time: new Date(res.data.time).toLocaleTimeString(),
        action: res.data.action,
        is_late: res.data.is_late,
        late_minutes: res.data.late_minutes,
        overtime_hours: res.data.overtime_hours,
      });
      setEmpCode('');
      fetchToday();
    } catch (err: any) {
      setResult({
        type: 'error',
        message: err.response?.data?.message || 'Punch failed. Try again.',
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const padZero = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${padZero(clock.getHours())}:${padZero(clock.getMinutes())}:${padZero(clock.getSeconds())}`;
  const dateStr = clock.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="punch-screen">
      {/* Top Controls Bar */}
      <div style={{ width: '100%', maxWidth: 960, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="logo-icon" style={{ width: 34, height: 34, fontSize: 16 }}>
            <CheckSquare size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-main)', lineHeight: 1.2 }}>AttendPro Terminal</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Security Gate Attendance Punch</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Switch Light/Dark Theme">
            {theme === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#0284c7" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          {hasRole('admin', 'hr', 'payroll') && (
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/dashboard')}>
              <ArrowLeft size={14} /> Dashboard
            </button>
          )}
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => { logout(); navigate('/login'); }} title="Sign Out">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 960, alignItems: 'flex-start' }}>
        {/* Punch Panel */}
        <div className="punch-card animate-fadeInUp" style={{ flex: 1 }}>
          <div className="punch-clock">{timeStr}</div>
          <div className="punch-date">{dateStr}</div>

          {/* Action Toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
            padding: 4, marginBottom: 20, border: '1px solid var(--border-color)'
          }}>
            {(['auto', 'in', 'out'] as const).map(a => (
              <button key={a} onClick={() => setAction(a)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 6, border: 'none',
                background: action === a ? (a === 'auto' ? 'var(--primary-600)' : a === 'in' ? 'var(--accent-success)' : 'var(--accent-primary-dark)') : 'transparent',
                color: action === a ? '#fff' : 'var(--text-secondary)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'var(--transition)',
              }}>
                {a === 'auto' ? '⚡ AUTO (IN/OUT)' : a === 'in' ? '🟢 PUNCH IN' : '🔵 PUNCH OUT'}
              </button>
            ))}
          </div>

          <form onSubmit={handlePunch}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Employee Code
            </label>
            <input
              ref={inputRef}
              id="guard-emp-code"
              className="punch-input-big"
              value={empCode}
              onChange={e => setEmpCode(e.target.value)}
              placeholder="EMP001"
              autoFocus
              autoComplete="off"
            />
            <button
              id="guard-punch-btn"
              type="submit"
              className={`punch-btn ${action === 'auto' ? 'punch-btn-auto' : action === 'in' ? 'punch-btn-in' : 'punch-btn-out'}`}
              disabled={loading || !empCode.trim()}
            >
              {loading ? '⏳ Processing...' : action === 'auto' ? '⚡ PUNCH (AUTO IN / OUT)' : action === 'in' ? '✅ PUNCH IN' : '🏁 PUNCH OUT'}
            </button>
          </form>

          {result && (
            <div className={`punch-result ${result.type}`}>
              {result.type === 'success' ? (
                <>
                  <div className="result-name">
                    {result.action === 'out' ? '🏁' : '✅'} {result.name} ({result.action === 'out' ? 'PUNCH OUT' : 'PUNCH IN'})
                  </div>
                  <div className="result-msg">{result.message}</div>
                  {Boolean(result.is_late && result.late_minutes && result.late_minutes > 0) && (
                    <div style={{ color: 'var(--accent-warning)', fontSize: 12, marginTop: 4 }}>
                      ⏰ Late by {result.late_minutes} minutes
                    </div>
                  )}
                  {Boolean(result.overtime_hours && result.overtime_hours > 0) && (
                    <div style={{ color: 'var(--accent-primary)', fontSize: 12, marginTop: 4 }}>
                      ⚡ Overtime: {result.overtime_hours}h
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>❌ {result.message}</div>
              )}
            </div>
          )}
        </div>

        {/* Today's List */}
        <div className="card animate-fadeInUp" style={{ width: 340, flex: 'none' }}>
          <div className="card-header">
            <div className="card-title">Today's Attendance</div>
            <span className="badge badge-green">
              <span className="pulse-dot" style={{ width: 6, height: 6 }} />
              Live
            </span>
          </div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {todayList.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-desc">No punches yet today</div>
              </div>
            ) : (
              todayList.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: i < todayList.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--accent-primary-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)'
                  }}>
                    {rec.name?.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.emp_code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge badge-${rec.status === 'present' ? 'green' : rec.status === 'late' ? 'yellow' : 'red'}`} style={{ fontSize: 10 }}>
                      {rec.status}
                    </span>
                    {rec.punch_in && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        IN: {new Date(rec.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {rec.punch_out && ` • OUT: ${new Date(rec.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
