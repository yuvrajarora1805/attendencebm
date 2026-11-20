import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Calendar, UserCheck, CheckCircle2, AlertTriangle, 
  Search, ShieldAlert, ArrowRightCircle, Sparkles, RefreshCw, Send, DollarSign,
  Palmtree, UserX, AlertCircle, RotateCcw, FileText, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, DoorOpen
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import BatchAdvanceModal from '../components/BatchAdvanceModal';
import MarkLeaveModal from '../components/MarkLeaveModal';
import LeaveSlipPDF from '../components/LeaveSlipPDF';
import EditAttendanceModal from '../components/EditAttendanceModal';
import ApplyGatePassModal from '../components/ApplyGatePassModal';

export const ManagerAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [clock, setClock] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'present' | 'unpunched' | 'leave' | 'absent'>('all');

  // Pagination & Chunking state (25 entries per chunk)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    startRecord: 0,
    endRecord: 0
  });
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    present: 0,
    unpunched: 0,
    leave: 0,
    absent: 0
  });

  // Debounce search input to avoid unnecessary requests while typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Modals
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leavePreSelectedEmpId, setLeavePreSelectedEmpId] = useState<string | number | null>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Leave Slip PDF Modal state
  const [leaveSlipModalOpen, setLeaveSlipModalOpen] = useState(false);
  const [leaveSlipEmpId, setLeaveSlipEmpId] = useState<string | number | null>(null);
  const [leaveSlipDate, setLeaveSlipDate] = useState<string>('');
  const [editRecord, setEditRecord] = useState<any | null>(null);

  // Gate Pass Modal state
  const [gatePassModalOpen, setGatePassModalOpen] = useState(false);
  const [gatePassEmpId, setGatePassEmpId] = useState<string | number | null>(null);

  // Auto-absent action state
  const [autoAbsentLoading, setAutoAbsentLoading] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Punch form state
  const [defaultPunchMode, setDefaultPunchMode] = useState<'both' | 'auto' | 'in' | 'out'>(() => {
    return (localStorage.getItem('default_punch_mode') as any) || 'both';
  });
  const [empCode, setEmpCode] = useState('');
  const [punchAction, setPunchAction] = useState<'auto' | 'in' | 'out' | 'both'>(() => {
    return (localStorage.getItem('default_punch_mode') as any) || 'both';
  });
  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('18:00');
  const [useCustomTime, setUseCustomTime] = useState(true);
  const [customTime, setCustomTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [punchReason, setPunchReason] = useState('');
  const [punchDate, setPunchDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [submitting, setSubmitting] = useState(false);
  const [punchResult, setPunchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (isBackground = false, overridePage?: number) => {
    try {
      if (!isBackground) setLoading(true);
      const targetPage = overridePage !== undefined ? overridePage : currentPage;
      const params = new URLSearchParams({
        date: selectedDate,
        page: String(targetPage),
        limit: String(pageSize),
        tab: activeTab,
        dept: selectedDept !== 'all' ? selectedDept : '',
        search: debouncedSearch.trim()
      });

      const [todayRes, deptRes, empRes] = await Promise.all([
        api.get(`/attendance/today?${params.toString()}`).catch(() => ({ data: { data: [], pagination: null, meta: {}, tabCounts: {} } })),
        api.get('/employees/series-info')
          .catch(() => api.get('/employees/meta/departments'))
          .catch(() => ({ data: { data: [] } })),
        api.get('/employees?status=active').catch(() => ({ data: { data: [] } }))
      ]);

      const chunkData = todayRes.data?.data || [];
      setRecords(chunkData);
      setUnpunchedEmployees(todayRes.data?.unpunched || []);
      if (todayRes.data?.pagination) {
        setPagination(todayRes.data.pagination);
      } else {
        setPagination({
          page: targetPage,
          limit: pageSize,
          totalRecords: chunkData.length,
          totalPages: Math.max(1, Math.ceil(chunkData.length / pageSize)),
          hasNextPage: false,
          hasPrevPage: targetPage > 1,
          startRecord: chunkData.length > 0 ? (targetPage - 1) * pageSize + 1 : 0,
          endRecord: chunkData.length
        });
      }
      if (todayRes.data?.tabCounts) {
        setTabCounts(todayRes.data.tabCounts);
      }
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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, activeTab, selectedDept, debouncedSearch, pageSize]);

  // Load data whenever filters or currentPage change
  useEffect(() => {
    loadData();
  }, [selectedDate, currentPage, pageSize, activeTab, selectedDept, debouncedSearch]);

  // Periodic background update (silent 25s polling)
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 25000);
    return () => clearInterval(interval);
  }, [selectedDate, currentPage, pageSize, activeTab, selectedDept, debouncedSearch]);

  const handleManagerPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode.trim()) return;

    setSubmitting(true);
    setPunchResult(null);

    try {
      const targetDate = punchDate || selectedDate;
      const payload: any = {
        emp_code: empCode.trim().toUpperCase(),
        action: punchAction,
        punch_date: targetDate,
      };

      if (punchAction === 'both') {
        payload.in_time = inTime;
        payload.out_time = outTime;
      } else if (useCustomTime && customTime) {
        payload.punch_time = customTime;
      }
      if (punchReason.trim()) {
        payload.notes = punchReason.trim();
      }

      const res = await api.post('/attendance/punch', payload);
      setPunchResult({
        type: 'success',
        message: `✅ ${res.data.emp_name}: ${res.data.message || 'Punch recorded successfully'} (${targetDate})`
      });
      setEmpCode('');
      setPunchReason('');
      if (targetDate === selectedDate) {
        loadData();
      } else {
        setSelectedDate(targetDate);
      }
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

  // Disapprove leave (converts to Absent when Section Head rejects slip)
  const handleDisapproveLeave = async (rec: any) => {
    const empName = rec.name || rec.emp_name;
    const leaveDate = rec.date || selectedDate;
    const promptReason = window.prompt(
      `Section Head Disapproved leave for ${empName} on ${leaveDate}.\n\nEnter Section Head disapproval reason / remarks:`,
      'Workload / Excessive leaves'
    );
    if (promptReason === null) return;

    try {
      const res = await api.post('/attendance/leave/disapprove', {
        emp_id: rec.emp_id || rec.id,
        emp_code: rec.emp_code,
        date: leaveDate,
        reason: promptReason.trim() || 'Disapproved by Section Head'
      });
      setBannerAlert({
        type: 'success',
        message: res.data?.message || `Leave disapproved. ${empName} marked as ABSENT.`
      });
      loadData();
    } catch (err: any) {
      setBannerAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to disapprove leave.'
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

  // Quick Gate IN return handler
  const handleQuickGateIn = async (passId: number, empName: string) => {
    if (!window.confirm(`Mark Gate IN (Premises Return) for ${empName} now?`)) return;
    try {
      await api.post(`/gate-pass/${passId}/in`, {
        actual_in_time: new Date().toISOString()
      });
      setBannerAlert({
        type: 'success',
        message: `${empName} marked Gate IN successfully. Shift deduction updated.`
      });
      loadData(true);
      setTimeout(() => setBannerAlert(null), 5000);
    } catch (err: any) {
      setBannerAlert({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record Gate IN'
      });
      setTimeout(() => setBannerAlert(null), 5000);
    }
  };

  // Pre-fill punch form
  const handleQuickPunch = (code: string, act?: 'both' | 'auto' | 'in' | 'out') => {
    setEmpCode(code);
    setPunchAction(act || defaultPunchMode);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Dynamically compute available departments list (merging API with live employee roster fallback)
  const departmentOptions = useMemo(() => {
    const deptMap = new Map<string, { id?: any; name: string; series?: string; count: number }>();

    // 1. Add departments returned by API (series-info or meta/departments)
    if (Array.isArray(departments)) {
      departments.forEach((d: any) => {
        const name = String(d.dept_name || d.name || '').trim();
        if (!name) return;
        deptMap.set(name.toLowerCase(), {
          id: d.dept_id || d.id,
          name: name,
          series: d.series_prefix || '',
          count: Number(d.emp_count) || 0
        });
      });
    }

    // 2. Discover departments directly from loaded active records, unpunched employees, and active employees
    const allRosterItems = [...records, ...unpunchedEmployees, ...allEmployees];
    allRosterItems.forEach((item: any) => {
      const name = String(item.department_name || item.dept_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          name: name,
          count: 0
        });
      }
    });

    // 3. Compute live count of active employees in today's roster for each department
    const currentRoster = [...records, ...unpunchedEmployees.map(u => ({ ...u, is_unpunched: true }))];
    const deptRosterCounts = new Map<string, number>();
    currentRoster.forEach(r => {
      const name = String(r.department_name || r.dept_name || '').trim().toLowerCase();
      if (name) {
        deptRosterCounts.set(name, (deptRosterCounts.get(name) || 0) + 1);
      }
    });

    return Array.from(deptMap.values())
      .map(dept => {
        const key = dept.name.toLowerCase();
        const rosterCount = deptRosterCounts.get(key) ?? dept.count;
        return {
          ...dept,
          count: rosterCount
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, records, unpunchedEmployees, allEmployees]);

  // Effective tab counts (from backend chunk metadata or fallback)
  const activeTabCounts = {
    all: tabCounts.all || (meta.total_active_employees || 0),
    present: tabCounts.present || (meta.punched_count || 0),
    unpunched: tabCounts.unpunched || (meta.unpunched_count || unpunchedEmployees.length),
    leave: tabCounts.leave || (meta.leave_count || 0),
    absent: tabCounts.absent || (meta.absent_count || 0)
  };

  // In chunked mode, records is already the paginated, filtered 25-entry slice from the server
  let displayList: any[] = [];
  if (unpunchedEmployees.length > 0 && records.every(r => !r.is_unpunched)) {
    // Legacy fallback
    const unpunchedMapped = unpunchedEmployees.map(u => ({
      ...u,
      is_unpunched: true,
      status: 'unpunched',
      punch_in: null,
      punch_out: null
    }));
    displayList = [...records, ...unpunchedMapped].slice(0, pageSize);
  } else {
    displayList = records;
  }

  const unpunchedCount = meta.unpunched_count || activeTabCounts.unpunched;

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

          {/* Gate Pass Button */}
          <button
            className="btn btn-secondary"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '9px 14px',
              background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b'
            }}
            onClick={() => {
              setGatePassEmpId(null);
              setGatePassModalOpen(true);
            }}
            title="Issue Gate Pass for Staff"
          >
            <DoorOpen size={16} color="#d97706" /> Gate Pass
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
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px'
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
              ({meta.active_inside_count || 0} inside)
            </span>
          </div>
        </div>

        <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>🚪 Outside on Pass</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>
            {records.filter(r => r.active_gate_pass).length}
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#c2410c', marginLeft: '6px' }}>
              ({records.reduce((sum, r) => sum + (Number(r.gate_pass_minutes) || 0), 0)}m cut)
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
            {/* Punch Action Toggle & Default Preference */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Punch Action</span>
                <button
                  type="button"
                  onClick={() => {
                    const newDef = punchAction;
                    localStorage.setItem('default_punch_mode', newDef);
                    setDefaultPunchMode(newDef);
                    setBannerAlert({
                      type: 'success',
                      message: `Default punch mode set to '${newDef === 'both' ? '⏱️ BOTH (IN+OUT)' : newDef === 'auto' ? '⚡ AUTO' : newDef === 'in' ? '🟢 IN' : '🔵 OUT'}'. This will open by default.`
                    });
                    setTimeout(() => setBannerAlert(null), 4000);
                  }}
                  style={{
                    background: defaultPunchMode === punchAction ? 'rgba(22, 163, 74, 0.1)' : 'transparent',
                    border: defaultPunchMode === punchAction ? '1px solid rgba(22, 163, 74, 0.3)' : '1px dashed var(--border-color)',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    fontSize: '10px',
                    color: defaultPunchMode === punchAction ? '#16a34a' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 700
                  }}
                  title="Save currently active mode as your persistent default"
                >
                  {defaultPunchMode === punchAction ? '★ Current Default' : '☆ Set as Default'}
                </button>
              </div>

              <div style={{
                display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px',
                padding: '3px', border: '1px solid var(--border-color)'
              }}>
                {(['both', 'auto', 'in', 'out'] as const).map(act => (
                  <button
                    type="button"
                    key={act}
                    onClick={() => setPunchAction(act)}
                    style={{
                      flex: 1, padding: '7px 2px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                      border: 'none', cursor: 'pointer', transition: 'var(--transition)',
                      background: punchAction === act ? 'var(--accent-primary)' : 'transparent',
                      color: punchAction === act ? '#fff' : 'var(--text-secondary)',
                      position: 'relative'
                    }}
                  >
                    {act === 'both' ? '⏱️ BOTH' : act === 'auto' ? '⚡ AUTO' : act === 'in' ? '🟢 IN' : '🔵 OUT'}
                    {defaultPunchMode === act && (
                      <span style={{
                        position: 'absolute', top: '1px', right: '3px', fontSize: '9px',
                        color: punchAction === act ? '#fef08a' : '#16a34a'
                      }}>★</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendance Date (Custom Date Option) */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} color="var(--accent-primary)" /> Punch Date *
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {punchDate !== new Date().toISOString().split('T')[0] && (
                    <button
                      type="button"
                      onClick={() => setPunchDate(new Date().toISOString().split('T')[0])}
                      style={{
                        padding: '1px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px',
                        border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer'
                      }}
                      title="Reset date to Today"
                    >
                      Today
                    </button>
                  )}
                  {punchDate !== selectedDate && (
                    <button
                      type="button"
                      onClick={() => setPunchDate(selectedDate)}
                      style={{
                        padding: '1px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '4px',
                        border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer'
                      }}
                      title="Sync with current roster view date"
                    >
                      Sync View Date
                    </button>
                  )}
                </div>
              </div>
              <input
                type="date"
                className="form-input"
                value={punchDate}
                onChange={e => setPunchDate(e.target.value)}
                required
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  background: punchDate !== new Date().toISOString().split('T')[0] ? '#fffbeb' : undefined,
                  borderColor: punchDate !== new Date().toISOString().split('T')[0] ? '#f59e0b' : undefined
                }}
              />
              {punchDate !== new Date().toISOString().split('T')[0] && (
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠️ Custom Date: Recording punch for <strong>{punchDate}</strong>
                </div>
              )}
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

            {/* Time Option: Dual In+Out vs Single Time */}
            {punchAction === 'both' ? (
              <div style={{
                background: 'rgba(2, 132, 199, 0.06)', borderRadius: '10px', padding: '12px',
                marginBottom: '14px', border: '1px solid rgba(2, 132, 199, 0.25)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Full Shift Punch (IN & OUT Together)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '3px' }}>
                      🟢 Punch IN Time *
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={inTime}
                      onChange={e => setInTime(e.target.value)}
                      required
                      style={{ fontSize: '13px', fontWeight: 700, padding: '6px 8px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', marginBottom: '3px' }}>
                      🔵 Punch OUT Time *
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={outTime}
                      onChange={e => setOutTime(e.target.value)}
                      required
                      style={{ fontSize: '13px', fontWeight: 700, padding: '6px 8px' }}
                    />
                  </div>
                </div>

                {/* Duration & Overtime Preview */}
                <div style={{
                  fontSize: '11px', background: '#ffffff', border: '1px solid #cbd5e1',
                  borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', color: '#475569'
                }}>
                  <span>Shift: <strong>{inTime}</strong> - <strong>{outTime}</strong></span>
                  <span style={{ fontWeight: 800, color: '#0284c7' }}>
                    {(() => {
                      const [inH, inM] = inTime.split(':').map(Number);
                      const [outH, outM] = outTime.split(':').map(Number);
                      let mins = (outH * 60 + outM) - (inH * 60 + inM);
                      if (mins < 0) mins += 24 * 60;
                      const hrs = Math.floor(mins / 60);
                      const remM = mins % 60;
                      return `⏱️ ${hrs}h ${remM}m`;
                    })()}
                  </span>
                </div>
              </div>
            ) : (
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
            )}

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
              {submitting ? '⏳ Recording...' : punchAction === 'both' ? 'Submit Complete Shift (IN + OUT)' : 'Submit Attendance Punch'}
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
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'all' ? '#1e293b' : '#f1f5f9',
                color: activeTab === 'all' ? '#ffffff' : '#475569'
              }}
            >
              All Staff ({activeTabCounts.all})
            </button>
            <button
              onClick={() => { setActiveTab('present'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'present' ? '#15803d' : '#f0fdf4',
                color: activeTab === 'present' ? '#ffffff' : '#15803d'
              }}
            >
              🟢 Present ({activeTabCounts.present})
            </button>
            <button
              onClick={() => { setActiveTab('unpunched'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'unpunched' ? '#b45309' : '#fffbeb',
                color: activeTab === 'unpunched' ? '#ffffff' : '#b45309'
              }}
            >
              ⏳ Unpunched ({activeTabCounts.unpunched})
            </button>
            <button
              onClick={() => { setActiveTab('leave'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'leave' ? '#0284c7' : '#f0f9ff',
                color: activeTab === 'leave' ? '#ffffff' : '#0284c7'
              }}
            >
              🌴 On Leave ({activeTabCounts.leave})
            </button>
            <button
              onClick={() => { setActiveTab('absent'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: activeTab === 'absent' ? '#dc2626' : '#fef2f2',
                color: activeTab === 'absent' ? '#ffffff' : '#dc2626'
              }}
            >
              🔴 Absent ({activeTabCounts.absent})
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  className="form-input"
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  style={{ minWidth: '220px', fontSize: '12px' }}
                >
                  <option value="all">
                    🏢 All Departments ({departmentOptions.length > 0 ? departmentOptions.length : 0})
                  </option>
                  {departmentOptions.map(d => (
                    <option key={d.name} value={d.name}>
                      {d.name} {d.series ? `(${d.series})` : (d.count ? `(${d.count})` : '')}
                    </option>
                  ))}
                </select>

                {selectedDept !== 'all' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedDept('all')}
                    title="Clear Department Filter"
                    style={{ padding: '6px 9px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong>{r.name || r.emp_name}</strong>
                            {r.active_gate_pass && (
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                                display: 'inline-flex', alignItems: 'center', gap: '3px'
                              }}>
                                🚪 OUT ({r.active_gate_pass.pass_type?.toUpperCase()})
                              </span>
                            )}
                          </div>

                          {/* Active Gate Pass notice & reason */}
                          {r.active_gate_pass && (
                            <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px', fontWeight: 600 }}>
                              Out at {r.active_gate_pass.actual_out_time ? new Date(r.active_gate_pass.actual_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : r.active_gate_pass.expected_out_time}
                              {r.active_gate_pass.reason ? ` • Reason: "${r.active_gate_pass.reason}"` : ''}
                            </div>
                          )}

                          {/* Completed Gate Pass deduction & reason */}
                          {Number(r.gate_pass_minutes || 0) > 0 && !r.active_gate_pass && (
                            <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px', fontWeight: 600 }}>
                              🎫 Gate Pass: -{Math.floor(r.gate_pass_minutes / 60)}h {r.gate_pass_minutes % 60}m cut
                              {r.gate_passes && r.gate_passes.length > 0 && (
                                <span style={{ color: '#64748b', fontWeight: 500, marginLeft: '4px' }}>
                                  ({r.gate_passes.map((p: any) => p.reason).filter(Boolean).join(', ')})
                                </span>
                              )}
                            </div>
                          )}

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
                            <div>
                              <span style={{ color: '#0284c7', fontWeight: 600 }}>
                                {new Date(r.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {r.punch_in && (() => {
                                const rawMins = Math.round((new Date(r.punch_out).getTime() - new Date(r.punch_in).getTime()) / (1000 * 60));
                                const effMins = Math.max(0, rawMins - (Number(r.gate_pass_minutes) || 0));
                                return (
                                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
                                    ⏱️ {Math.floor(effMins / 60)}h {effMins % 60}m net
                                    {Number(r.gate_pass_minutes) > 0 && (
                                      <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '3px' }}>
                                        (-{r.gate_pass_minutes}m GP)
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
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
                                  setLeavePreSelectedEmpId(r.emp_code || r.emp_id || r.employee_id || r.id);
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
                                onClick={() => handleQuickPunch(r.emp_code, 'both')}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', cursor: 'pointer'
                                }}
                                title="Quick Full Shift Punch (IN+OUT)"
                              >
                                ⚡ Punch
                              </button>
                            </div>
                          ) : (isLeave || isAbsent) ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              {isLeave && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLeaveSlipEmpId(r.emp_code || r.emp_id || r.employee_id || r.id);
                                      setLeaveSlipDate(r.date || selectedDate);
                                      setLeaveSlipModalOpen(true);
                                    }}
                                    style={{
                                      padding: '3px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                      background: '#0284c7', color: '#ffffff', border: 'none', cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', gap: '3px'
                                    }}
                                    title="Print / View Leave Slip for Section Head"
                                  >
                                    <FileText size={11} /> 📄 Slip
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDisapproveLeave(r)}
                                    style={{
                                      padding: '3px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', gap: '2px'
                                    }}
                                    title="Disapprove leave and mark employee as Absent"
                                  >
                                    ✕ Disapprove
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleResetRecord(r.id, r.name || r.emp_name)}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                  background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '3px'
                                }}
                                title="Reset/Undo attendance record so employee can punch in"
                              >
                                <RotateCcw size={11} /> Reset
                              </button>
                            </div>
                          ) : isPresent && !r.punch_out ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              {r.active_gate_pass ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickGateIn(r.active_gate_pass.id, r.name || r.emp_name)}
                                  style={{
                                    padding: '3px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                    background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '3px'
                                  }}
                                  title="Mark employee Gate IN (Premises Return)"
                                >
                                  🚪 IN
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGatePassEmpId(r.emp_id || r.employee_id || r.id || r.emp_code);
                                    setGatePassModalOpen(true);
                                  }}
                                  style={{
                                    padding: '3px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                    background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '2px'
                                  }}
                                  title="Issue Gate Pass for this employee"
                                >
                                  🎫 Pass
                                </button>
                              )}
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
                              <button
                                type="button"
                                onClick={() => setEditRecord(r)}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                  background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '2px'
                                }}
                                title="Edit punch time or status"
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                              {r.active_gate_pass ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickGateIn(r.active_gate_pass.id, r.name || r.emp_name)}
                                  style={{
                                    padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '5px',
                                    background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer'
                                  }}
                                  title="Mark Gate IN (Return)"
                                >
                                  🚪 IN
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGatePassEmpId(r.emp_id || r.employee_id || r.id || r.emp_code);
                                    setGatePassModalOpen(true);
                                  }}
                                  style={{
                                    padding: '3px 6px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                    background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', cursor: 'pointer'
                                  }}
                                  title="Issue Gate Pass"
                                >
                                  🎫 Pass
                                </button>
                              )}
                              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>✓ Done</span>
                              <button
                                type="button"
                                onClick={() => setEditRecord(r)}
                                style={{
                                  padding: '3px 7px', fontSize: '11px', fontWeight: 600, borderRadius: '5px',
                                  background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '2px'
                                }}
                                title="Edit Punch Time"
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Chunk Pagination Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderTop: '1px solid var(--border-color)',
            background: '#fafafa',
            flexWrap: 'wrap',
            gap: '12px',
            borderRadius: '0 0 14px 14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Showing <strong>{pagination.startRecord}</strong> - <strong>{pagination.endRecord}</strong> of <strong>{pagination.totalRecords}</strong> staff
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chunk Size:</span>
                <select
                  className="form-input"
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{ height: '28px', fontSize: '11px', padding: '2px 8px', width: '95px' }}
                >
                  <option value={25}>25 / chunk</option>
                  <option value={50}>50 / chunk</option>
                  <option value={100}>100 / chunk</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage(1)}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', opacity: currentPage <= 1 ? 0.4 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                title="First Page"
              >
                <ChevronsLeft size={13} /> First
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!pagination.hasPrevPage || loading}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', opacity: !pagination.hasPrevPage ? 0.4 : 1, cursor: !pagination.hasPrevPage ? 'not-allowed' : 'pointer' }}
                title="Previous 25 entries"
              >
                <ChevronLeft size={13} /> Prev
              </button>

              <div style={{ padding: '0 8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                Page {pagination.page} of {pagination.totalPages}
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={!pagination.hasNextPage || loading}
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', opacity: !pagination.hasNextPage ? 0.4 : 1, cursor: !pagination.hasNextPage ? 'not-allowed' : 'pointer' }}
                title="Next 25 entries"
              >
                Next <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={currentPage >= pagination.totalPages || loading}
                onClick={() => setCurrentPage(pagination.totalPages)}
                style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px', opacity: currentPage >= pagination.totalPages ? 0.4 : 1, cursor: currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
                title="Last Page"
              >
                Last <ChevronsRight size={13} />
              </button>
            </div>
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
        onSuccess={(msg, slipMeta) => {
          setBannerAlert({ type: 'success', message: msg || 'Leave successfully recorded.' });
          loadData();
          if (slipMeta?.emp_id) {
            setLeaveSlipEmpId(slipMeta.emp_id);
            setLeaveSlipDate(slipMeta.date);
            setLeaveSlipModalOpen(true);
          }
          setTimeout(() => setBannerAlert(null), 6000);
        }}
        employees={allEmployees}
        preSelectedEmpId={leavePreSelectedEmpId}
        defaultDate={selectedDate}
      />

      {/* Leave Application & Sanction Slip PDF Modal */}
      <LeaveSlipPDF
        isOpen={leaveSlipModalOpen}
        onClose={() => {
          setLeaveSlipModalOpen(false);
          setLeaveSlipEmpId(null);
        }}
        empId={leaveSlipEmpId}
        leaveDate={leaveSlipDate || selectedDate}
      />

      {/* Edit Attendance Punch Modal */}
      <EditAttendanceModal
        isOpen={!!editRecord}
        onClose={() => setEditRecord(null)}
        onSuccess={() => {
          setBannerAlert({ type: 'success', message: 'Attendance punch updated successfully.' });
          loadData();
          setTimeout(() => setBannerAlert(null), 5000);
        }}
        record={editRecord}
      />

      {/* Apply Gate Pass Modal */}
      <ApplyGatePassModal
        isOpen={gatePassModalOpen}
        onClose={() => {
          setGatePassModalOpen(false);
          setGatePassEmpId(null);
        }}
        onSuccess={() => {
          setGatePassModalOpen(false);
          setGatePassEmpId(null);
          setBannerAlert({ type: 'success', message: 'Gate pass generated successfully.' });
          loadData(true);
          setTimeout(() => setBannerAlert(null), 5000);
        }}
        defaultEmpId={gatePassEmpId}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default ManagerAttendancePage;
