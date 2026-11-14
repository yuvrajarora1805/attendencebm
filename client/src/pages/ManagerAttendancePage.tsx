import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, UserCheck, CheckCircle2, AlertTriangle, 
  Search, ShieldAlert, ArrowRightCircle, Sparkles, RefreshCw, Send, DollarSign,
  Palmtree, UserX, AlertCircle, RotateCcw
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import BatchAdvanceModal from '../components/BatchAdvanceModal';
import MarkLeaveModal from '../components/MarkLeaveModal';

export const ManagerAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [clock, setClock] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [unpunchedEmployees, setUnpunchedEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({
    total_active_employees: 0,
    punched_count: 0,
    active_inside_count: 0,
    completed_count: 0,
    leave_count: 0,
    absent_count: 0,
    unpunched_count: 0
  });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'unpunched' | 'leave' | 'absent'>('all');

  // Modals
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leavePreSelectedEmpId, setLeavePreSelectedEmpId] = useState<string | number | null>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Auto-absent action state
  const [autoAbsentLoading, setAutoAbsentLoading] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Punch form state
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

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [todayRes, deptRes, empRes] = await Promise.all([
        api.get(`/attendance/today?date=${selectedDate}`).catch(() => ({ data: { data: [], unpunched: [], meta: {} } })),
        api.get('/employees/series-info').catch(() => ({ data: { data: [] } })),
        api.get('/employees?status=active').catch(() => ({ data: { data: [] } }))
      ]);

      setRecords(todayRes.data?.data || []);
      setUnpunchedEmployees(todayRes.data?.unpunched || []);
      if (todayRes.data?.meta) {
        setMeta(todayRes.data.meta);
      }
      setDepartments(deptRes.data?.data || []);
      setAllEmployees(empRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load manager records', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 25000);
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

  // One-click Auto Mark Absent
  const handleAutoMarkAbsent = async () => {
    const unpunchedCount = meta.unpunched_count || unpunchedEmployees.length;
    if (unpunchedCount === 0) {
      setBannerAlert({
        type: 'success',
        message: 'All active employees have already punched in or been marked.'
      });
      return;
    }

    const confirmMsg = `Are you sure you want to mark all ${unpunchedCount} unpunched employee(s) as ABSENT for ${selectedDate}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setAutoAbsentLoading(true);
      const res = await api.post('/attendance/auto-absent', { date: selectedDate });
      setBannerAlert({
        type: 'success',
        message: res.data?.message || `Successfully marked ${res.data?.count || unpunchedCount} employees as absent.`
      });
      await loadData();
    } catch (err: any) {
      setBannerAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to auto-mark absent.'
      });
    } finally {
      setAutoAbsentLoading(false);
      setTimeout(() => setBannerAlert(null), 7000);
    }
  };

  // Mark single employee as absent
  const handleMarkSingleAbsent = async (emp: any) => {
    const confirmMsg = `Mark ${emp.name} (${emp.emp_code}) as ABSENT for ${selectedDate}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.post('/attendance/punch', {
        emp_code: emp.emp_code,
        action: 'in',
        punch_date: selectedDate,
        notes: 'Marked absent by supervisor'
      }).catch(async () => {
        // Fallback: use correction or auto-absent
        await api.post('/attendance/auto-absent', { date: selectedDate });
      });

      // Directly update record status to absent
      await api.post('/attendance/leave', {
        emp_id: emp.id,
        leave_type: 'unpaid',
        from_date: selectedDate,
        to_date: selectedDate,
        reason: 'Marked absent by supervisor'
      }).catch(() => {});

      setBannerAlert({
        type: 'success',
        message: `Marked ${emp.name} (${emp.emp_code}) as absent.`
      });
      loadData();
    } catch (err: any) {
      setBannerAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to mark employee absent.'
      });
    }
  };

  // Reset/Undo absent or leave record
  const handleResetRecord = async (recordId: number, empName: string) => {
    if (!window.confirm(`Reset attendance status for ${empName}? This will allow the employee to punch in.`)) {
      return;
    }

    try {
      await api.delete(`/attendance/record/${recordId}`);
      setBannerAlert({
        type: 'success',
        message: `Attendance record reset for ${empName}. Status is now pending.`
      });
      loadData();
    } catch (err: any) {
      setBannerAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reset attendance record.'
      });
    }
  };

  // Pre-fill punch form
  const handleQuickPunch = (code: string) => {
    setEmpCode(code);
    setPunchAction('in');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Filter combined records
  // Build unified roster based on activeTab
  let displayList: any[] = [];

  const normalizedSearch = search.trim().toLowerCase();
  const filterByDeptAndSearch = (item: any) => {
    const dept = String(item.department_name || item.dept_name || '').toLowerCase();
    const matchesDept = selectedDept === 'all' || dept === selectedDept.toLowerCase();
    const matchesSearch = !normalizedSearch || 
      String(item.name || '').toLowerCase().includes(normalizedSearch) ||
      String(item.emp_code || '').toLowerCase().includes(normalizedSearch);
    return matchesDept && matchesSearch;
  };

  if (activeTab === 'all') {
    // Show recorded attendance + unpunched
    const unpunchedMapped = unpunchedEmployees.map(u => ({
      ...u,
      is_unpunched: true,
      status: 'unpunched',
      punch_in: null,
      punch_out: null
    }));
    displayList = [...records, ...unpunchedMapped].filter(filterByDeptAndSearch);
  } else if (activeTab === 'present') {
    displayList = records.filter(r => r.punch_in != null).filter(filterByDeptAndSearch);
  } else if (activeTab === 'unpunched') {
    const unpunchedMapped = unpunchedEmployees.map(u => ({
      ...u,
      is_unpunched: true,
      status: 'unpunched',
      punch_in: null,
      punch_out: null
    }));
    displayList = unpunchedMapped.filter(filterByDeptAndSearch);
  } else if (activeTab === 'leave') {
    displayList = records.filter(r => r.status === 'leave').filter(filterByDeptAndSearch);
  } else if (activeTab === 'absent') {
    displayList = records.filter(r => r.status === 'absent').filter(filterByDeptAndSearch);
  }

  const unpunchedCount = meta.unpunched_count || unpunchedEmployees.length;

  return (
    <div style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        background: 'linear-gradient(135deg, rgba(2,132,199,0.12), rgba(37,99,235,0.06))',
        border: '1px solid rgba(2,132,199,0.25)', borderRadius: '16px', padding: '18px 24px', marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px' }}>👨‍💼</span>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Manager Attendance & Shift Desk
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Supervisor console: Live roster punches, grant employee leaves, and auto-mark absent.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Mark Leave Button */}
          <button
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '9px 15px',
              background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(2,132,199,0.3)', cursor: 'pointer'
            }}
            onClick={() => {
              setLeavePreSelectedEmpId(null);
              setLeaveModalOpen(true);
            }}
            title="Mark Single or Multi-day Leave for an employee"
          >
            <Palmtree size={16} /> 🌴 Mark Leave
          </button>

          {/* Auto-Mark Absent Button */}
          <button
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '9px 15px',
              background: unpunchedCount > 0 ? '#dc2626' : '#94a3b8', color: '#ffffff',
              border: 'none', borderRadius: '8px',
              boxShadow: unpunchedCount > 0 ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
              cursor: unpunchedCount > 0 && !autoAbsentLoading ? 'pointer' : 'not-allowed'
            }}
            disabled={unpunchedCount === 0 || autoAbsentLoading}
            onClick={handleAutoMarkAbsent}
            title={unpunchedCount > 0 ? `Mark all ${unpunchedCount} unpunched staff as absent` : 'No unpunched staff'}
          >
            <UserX size={16} /> ⚡ Auto-Mark Absent ({unpunchedCount})
          </button>

          {/* Advance Checklist Button */}
          <button
            className="btn btn-primary"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '9px 15px',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)', border: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
            }}
            onClick={() => setAdvanceModalOpen(true)}
            title="Open Active Employees Advance Checklist"
          >
            <DollarSign size={16} /> Advance Checklist
          </button>

          {/* Live Clock & Date Selector */}
          <div style={{ textAlign: 'right', marginLeft: '6px', paddingLeft: '12px', borderLeft: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>
              {clock.toLocaleTimeString('en-GB')}
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#475569',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '2px 6px',
                marginTop: '4px',
                cursor: 'pointer'
              }}
              title="Select Shift Date"
            />
          </div>
        </div>
      </div>

      {/* Banner Notification Alert */}
      {bannerAlert && (
        <div style={{
          padding: '12px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, marginBottom: '20px',
          background: bannerAlert.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: bannerAlert.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
          color: bannerAlert.type === 'success' ? '#16a34a' : '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span>{bannerAlert.message}</span>
          <button
            onClick={() => setBannerAlert(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Counter Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px'
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Active Staff</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
            {meta.total_active_employees || allEmployees.length}
          </div>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>🟢 Present Today</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
            {meta.punched_count || 0}
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#16a34a', marginLeft: '6px' }}>
              ({meta.active_inside_count || 0} working inside)
            </span>
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>⏳ Unpunched (Pending)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
            {unpunchedCount}
          </div>
        </div>

        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>🌴 On Leave</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
            {meta.leave_count || 0}
          </div>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>🔴 Marked Absent</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
            {meta.absent_count || 0}
          </div>
        </div>
      </div>

      {/* Grid Layout: Punch Tool + Live Attendance Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Manager Punch Box */}
        <div className="card" style={{ padding: '22px', borderRadius: '14px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Punch Attendance</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Shift Supervisor Punch Override</span>
            </div>
          </div>

          <form onSubmit={handleManagerPunch}>
            {/* Punch Action Toggle */}
            <div style={{
              display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px',
              padding: '3px', marginBottom: '14px', border: '1px solid var(--border-color)'
            }}>
              {(['auto', 'in', 'out'] as const).map(act => (
                <button
                  type="button"
                  key={act}
                  onClick={() => setPunchAction(act)}
                  style={{
                    flex: 1, padding: '7px 4px', fontSize: '12px', fontWeight: 700, borderRadius: '6px',
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
                style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}
              />
              {empCode.trim().length >= 2 && !allEmployees.some(e => e.emp_code?.toUpperCase() === empCode.trim().toUpperCase()) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto',
                  marginTop: '4px', padding: '4px'
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
                          padding: '6px 10px', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between',
                          borderRadius: '4px', fontSize: '12px', borderBottom: '1px solid #f1f5f9'
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

            {/* Time Option */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px', marginBottom: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: useCustomTime ? '8px' : '0' }}>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Punch with Specific Time?</span>
                <input
                  type="checkbox"
                  id="chk-custom-time"
                  checked={useCustomTime}
                  onChange={e => setUseCustomTime(e.target.checked)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />
              </div>

              {useCustomTime && (
                <div>
                  <input
                    type="time"
                    className="form-input"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                    required
                    style={{ fontSize: '13px' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginTop: '4px' }}>
                    ⏰ Recorded with time: {customTime}
                  </div>
                </div>
              )}
            </div>

            {/* Supervisor Reason/Note */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Supervisor Note (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Verified by Gate Supervisor"
                value={punchReason}
                onChange={e => setPunchReason(e.target.value)}
                style={{ fontSize: '12px' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !empCode.trim()}
              style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 700, justifyContent: 'center' }}
            >
              {submitting ? '⏳ Recording...' : 'Submit Attendance Punch'}
            </button>
          </form>

          {punchResult && (
            <div style={{
              marginTop: '14px', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: punchResult.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: punchResult.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
              color: punchResult.type === 'success' ? '#16a34a' : '#dc2626'
            }}>
              {punchResult.message}
            </div>
          )}
        </div>

        {/* Right Column: Attendance Records & Department Filters */}
        <div className="card" style={{ padding: '22px', borderRadius: '14px', border: '1px solid var(--border-color)', background: '#ffffff' }}>
          
          {/* Roster Filter Tabs */}
          <div style={{
            display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', overflowX: 'auto'
          }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'all' ? '#1e293b' : '#f1f5f9',
                color: activeTab === 'all' ? '#ffffff' : '#475569'
              }}
            >
              All Staff ({records.length + unpunchedEmployees.length})
            </button>
            <button
              onClick={() => setActiveTab('present')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'present' ? '#15803d' : '#f0fdf4',
                color: activeTab === 'present' ? '#ffffff' : '#15803d'
              }}
            >
              🟢 Present ({meta.punched_count || 0})
            </button>
            <button
              onClick={() => setActiveTab('unpunched')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'unpunched' ? '#b45309' : '#fffbeb',
                color: activeTab === 'unpunched' ? '#ffffff' : '#b45309'
              }}
            >
              ⏳ Unpunched ({unpunchedCount})
            </button>
            <button
              onClick={() => setActiveTab('leave')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'leave' ? '#0284c7' : '#f0f9ff',
                color: activeTab === 'leave' ? '#ffffff' : '#0284c7'
              }}
            >
              🌴 On Leave ({meta.leave_count || 0})
            </button>
            <button
              onClick={() => setActiveTab('absent')}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'absent' ? '#dc2626' : '#fef2f2',
                color: activeTab === 'absent' ? '#ffffff' : '#dc2626'
              }}
            >
              🔴 Absent ({meta.absent_count || 0})
            </button>
          </div>

          {/* Search and Department Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '200px' }}>
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
                style={{ width: '180px', fontSize: '12px' }}
              >
                <option value="all">🏢 All Departments ({departments.length})</option>
                {departments.map(d => (
                  <option key={d.dept_id} value={d.dept_name}>
                    {d.dept_name} ({d.series_prefix})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => loadData(false)}
                title="Refresh Live Data"
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: '560px' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Code</th>
                  <th>Employee Name</th>
                  <th>Department</th>
                  <th>Punch IN</th>
                  <th>Punch OUT</th>
                  <th>Status</th>
                  <th style={{ width: '180px', textAlign: 'center' }}>Supervisor Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No staff records found under this tab and filter.
                    </td>
                  </tr>
                ) : (
                  displayList.map((r, idx) => {
                    const isUnpunched = r.is_unpunched || !r.status || r.status === 'unpunched';
                    const isLeave = r.status === 'leave';
                    const isAbsent = r.status === 'absent';
                    const isPresent = r.status === 'present' || r.status === 'late';

                    return (
                      <tr key={idx} style={{ background: isUnpunched ? '#fffdfa' : 'transparent' }}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{r.emp_code}</td>
                        <td>
                          <strong>{r.name || r.emp_name}</strong>
                          {r.notes && (
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                              {r.notes}
                            </div>
                          )}
                        </td>
                        <td>{r.department_name || r.dept_name || '—'}</td>
                        <td>
                          {r.punch_in ? (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              {new Date(r.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {r.punch_out ? (
                            <span style={{ color: '#0284c7', fontWeight: 600 }}>
                              {new Date(r.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {isUnpunched ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                              background: '#fef3c7', color: '#b45309'
                            }}>
                              ⏳ Pending
                            </span>
                          ) : isLeave ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                              background: '#e0f2fe', color: '#0369a1'
                            }}>
                              🌴 Leave
                            </span>
                          ) : isAbsent ? (
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                              background: '#fee2e2', color: '#dc2626'
                            }}>
                              🔴 Absent
                            </span>
                          ) : (
                            <span className={`badge ${r.status === 'late' ? 'badge-warning' : 'badge-success'}`}>
                              {r.status}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isUnpunched ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setLeavePreSelectedEmpId(r.id);
                                  setLeaveModalOpen(true);
                                }}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                  background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', cursor: 'pointer'
                                }}
                                title="Mark Leave for this employee"
                              >
                                🌴 Leave
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkSingleAbsent(r)}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                  background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer'
                                }}
                                title="Mark Absent for today"
                              >
                                🔴 Absent
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickPunch(r.emp_code)}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'pointer'
                                }}
                                title="Quick Punch In"
                              >
                                ⚡ Punch
                              </button>
                            </div>
                          ) : (isLeave || isAbsent) ? (
                            <button
                              type="button"
                              onClick={() => handleResetRecord(r.id, r.name || r.emp_name)}
                              style={{
                                padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '3px'
                              }}
                              title="Reset/Undo attendance record so employee can punch in"
                            >
                              <RotateCcw size={11} /> Reset Status
                            </button>
                          ) : isPresent && !r.punch_out ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEmpCode(r.emp_code);
                                setPunchAction('out');
                              }}
                              style={{
                                padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', cursor: 'pointer'
                              }}
                              title="Punch Out this employee"
                            >
                              🔵 Punch OUT
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Advance Checklist Modal */}
      <BatchAdvanceModal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* Mark Leave Modal */}
      <MarkLeaveModal
        isOpen={leaveModalOpen}
        onClose={() => {
          setLeaveModalOpen(false);
          setLeavePreSelectedEmpId(null);
        }}
        onSuccess={(msg) => {
          setBannerAlert({ type: 'success', message: msg || 'Leave successfully recorded.' });
          loadData();
          setTimeout(() => setBannerAlert(null), 6000);
        }}
        employees={allEmployees}
        preSelectedEmpId={leavePreSelectedEmpId}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default ManagerAttendancePage;
