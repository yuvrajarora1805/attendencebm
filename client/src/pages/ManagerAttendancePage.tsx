import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, UserCheck, CheckCircle2, AlertTriangle, 
  Search, ShieldAlert, ArrowRightCircle, Sparkles, RefreshCw, Send, DollarSign
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import BatchAdvanceModal from '../components/BatchAdvanceModal';

export const ManagerAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [clock, setClock] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Punch modal / Form state
  const [empCode, setEmpCode] = useState('');
  const [punchAction, setPunchAction] = useState<'auto' | 'in' | 'out'>('auto');
  const [useCustomTime, setUseCustomTime] = useState(true);
  const [customTime, setCustomTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [punchReason, setPunchReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [punchResult, setPunchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [todayRes, deptRes, empRes] = await Promise.all([
        api.get('/attendance/today').catch(() => ({ data: { data: [] } })),
        api.get('/employees/series-info').catch(() => ({ data: { data: [] } })),
        api.get('/employees?status=active').catch(() => ({ data: { data: [] } }))
      ]);
      setRecords(todayRes.data?.data || []);
      setDepartments(deptRes.data?.data || []);
      setAllEmployees(empRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load manager records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const handleManagerPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode.trim()) return;

    setSubmitting(true);
    setPunchResult(null);

    try {
      const payload: any = {
        emp_code: empCode.trim().toUpperCase(),
        action: punchAction,
        punch_date: selectedDate,
      };

      if (useCustomTime && customTime) {
        payload.punch_time = customTime;
      }
      if (punchReason.trim()) {
        payload.notes = punchReason.trim();
      }

      const res = await api.post('/attendance/punch', payload);
      setPunchResult({
        type: 'success',
        message: `✅ ${res.data.emp_name}: ${res.data.message || 'Punch recorded successfully'}`
      });
      setEmpCode('');
      setPunchReason('');
      loadData();
    } catch (err: any) {
      setPunchResult({
        type: 'error',
        message: `❌ ${err.response?.data?.message || 'Failed to record punch'}`
      });
    } finally {
      setSubmitting(false);
      setTimeout(() => setPunchResult(null), 6000);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesDept = selectedDept === 'all' || 
      String(r.department_name || '').toLowerCase() === selectedDept.toLowerCase();
    const matchesSearch = !search || 
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.emp_code?.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const presentCount = records.filter(r => r.punch_in && !r.punch_out).length;
  const completedCount = records.filter(r => r.punch_in && r.punch_out).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(2,132,199,0.15), rgba(37,99,235,0.08))',
        border: '1px solid rgba(2,132,199,0.3)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>👨‍💼</span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Manager Attendance & Shift Punch Portal
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Supervisor live desk: View employee attendance status & punch with specific custom time
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontWeight: 700, 
              padding: '9px 16px',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
            }}
            onClick={() => setAdvanceModalOpen(true)}
            title="Open Active Employees Advance Checklist (50% Earned Wages Rule)"
          >
            <DollarSign size={16} /> ⚡ Request Employee Advance (Checklist)
          </button>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.02em', lineHeight: 1.1 }}>
              {clock.toLocaleTimeString('en-GB')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {clock.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Punch Tool + Live Attendance List */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Manager Punch Box */}
        <div className="card" style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Punch Attendance</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Shift Supervisor Punch Override</span>
            </div>
          </div>

          <form onSubmit={handleManagerPunch}>
            {/* Punch Action Toggle */}
            <div style={{
              display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px',
              padding: '3px', marginBottom: '16px', border: '1px solid var(--border-color)'
            }}>
              {(['auto', 'in', 'out'] as const).map(act => (
                <button
                  type="button"
                  key={act}
                  onClick={() => setPunchAction(act)}
                  style={{
                    flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: 700, borderRadius: '6px',
                    border: 'none', cursor: 'pointer', transition: 'var(--transition)',
                    background: punchAction === act ? 'var(--accent-primary)' : 'transparent',
                    color: punchAction === act ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  {act === 'auto' ? '⚡ AUTO' : act === 'in' ? '🟢 IN' : '🔵 OUT'}
                </button>
              ))}
            </div>

            {/* Employee Code */}
            <div className="form-group" style={{ marginBottom: '14px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>Employee Code / ID *</label>
                {allEmployees.find(e => e.emp_code?.toUpperCase() === empCode.trim().toUpperCase()) && (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                    ✓ {allEmployees.find(e => e.emp_code?.toUpperCase() === empCode.trim().toUpperCase())?.name}
                  </span>
                )}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Enter Emp Code (e.g. 7040) or Name..."
                value={empCode}
                onChange={e => setEmpCode(e.target.value.toUpperCase())}
                required
                style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em' }}
              />
              {empCode.trim().length >= 2 && !allEmployees.some(e => e.emp_code?.toUpperCase() === empCode.trim().toUpperCase()) && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  marginTop: '4px',
                  padding: '4px'
                }}>
                  {allEmployees
                    .filter(e => 
                      e.emp_code?.toUpperCase().includes(empCode.trim().toUpperCase()) ||
                      e.name?.toUpperCase().includes(empCode.trim().toUpperCase())
                    )
                    .slice(0, 8)
                    .map(e => (
                      <div
                        key={e.id}
                        onClick={() => setEmpCode(e.emp_code)}
                        style={{
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: '4px',
                          fontSize: '12px',
                          borderBottom: '1px solid #f1f5f9'
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <strong style={{ color: '#1d4ed8' }}>{e.emp_code}</strong> - {e.name}
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{e.department_name || e.dept_name || 'Staff'}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Time Option: Live Time vs Custom Time */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: useCustomTime ? '10px' : '0' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Punch with Specific Time?</span>
                <input
                  type="checkbox"
                  id="chk-custom-time"
                  checked={useCustomTime}
                  onChange={e => setUseCustomTime(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </div>

              {useCustomTime && (
                <div>
                  <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Select Exact Punch Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginTop: '4px' }}>
                    ⏰ Punch will be recorded with time: {customTime}
                  </div>
                </div>
              )}
            </div>

            {/* Supervisor Reason/Note */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontSize: '12px' }}>Remarks / Supervisor Note (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Verified by Gate Supervisor"
                value={punchReason}
                onChange={e => setPunchReason(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !empCode.trim()}
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, justifyContent: 'center' }}
            >
              {submitting ? '⏳ Recording...' : 'Submit Attendance Punch'}
            </button>
          </form>

          {punchResult && (
            <div style={{
              marginTop: '16px', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: punchResult.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: punchResult.type === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
              color: punchResult.type === 'success' ? '#10b981' : '#ef4444'
            }}>
              {punchResult.message}
            </div>
          )}
        </div>

        {/* Right Column: Attendance Records & Department Filters */}
        <div className="card" style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          {/* Top Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search code or name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12px' }}
                />
              </div>

              <select
                className="form-input"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                style={{ width: '200px', fontSize: '12px' }}
              >
                <option value="all">🏢 All Departments ({departments.length})</option>
                {departments.map(d => (
                  <option key={d.dept_id} value={d.dept_name}>
                    {d.dept_name} ({d.series_prefix})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="badge badge-success" style={{ fontSize: '12px', padding: '6px 12px' }}>
                Active Inside: {presentCount}
              </span>
              <span className="badge badge-info" style={{ fontSize: '12px', padding: '6px 12px' }}>
                Completed: {completedCount}
              </span>
              <button className="btn btn-secondary" onClick={loadData} title="Refresh Live Data" style={{ padding: '6px 10px' }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: '560px' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Punch IN</th>
                  <th>Punch OUT</th>
                  <th>Status</th>
                  <th>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No attendance records found for today under this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{r.emp_code}</td>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.department_name || '—'}</td>
                      <td>
                        {r.punch_in ? (
                          <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>
                            {new Date(r.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {r.punch_out ? (
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                            {new Date(r.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${r.status === 'present' ? 'badge-success' : r.status === 'late' ? 'badge-warning' : 'badge-danger'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {Number(r.overtime_hours || 0) > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--accent-warning)' }}>
                            {r.overtime_hours} hrs
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <BatchAdvanceModal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};

export default ManagerAttendancePage;
