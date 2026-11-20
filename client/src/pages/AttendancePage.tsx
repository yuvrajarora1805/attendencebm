import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, XCircle, Edit3, RefreshCw, UserCheck, AlertCircle, Eye, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Topbar from '../components/Topbar';
import DataTable, { Column } from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import ManualPunchModal from '../components/ManualPunchModal';
import EditAttendanceModal from '../components/EditAttendanceModal';

export const AttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [viewMode, setViewMode] = useState<'today' | 'monthly'>('today'); // Default to today's checks
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [todayMeta, setTodayMeta] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const { hasRole } = useAuth();

  const fetchAttendance = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      if (viewMode === 'today') {
        const res = await api.get('/attendance/today');
        setRecords(res.data?.data || []);
        setTodayMeta(res.data?.meta || null);
      } else {
        const res = await api.get(`/attendance/monthly?month=${month}&year=${year}`);
        setRecords(res.data?.data || []);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load attendance', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [viewMode, month, year]);

  // Optional background live refresh only when enabled by user
  useEffect(() => {
    if (viewMode !== 'today' || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAttendance(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [viewMode, autoRefresh]);

  // Calculate summary counts for Today
  const todayPresentCount = records.filter(r => r.status === 'present').length;
  const todayLateCount = records.filter(r => r.status === 'late' || Number(r.late_minutes) > 0).length;
  const todayStillInCount = records.filter(r => r.punch_in && !r.punch_out).length;
  const todayGatePassCount = records.filter(r => r.active_gate_pass).length;

  const columns: Column<any>[] = [
    ...(viewMode === 'monthly' ? [{
      key: 'date',
      header: 'Date',
      width: '110px',
      render: (row: any) => row.date?.slice(0, 10)
    }] : []),
    {
      key: 'emp_code',
      header: 'Code',
      width: '90px',
      render: (row: any) => (
        <span 
          style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}
          onClick={() => navigate(`/employees/${row.emp_id}`)}
          title="View Employee Profile & Analytics"
        >
          {row.emp_code}
        </span>
      )
    },
    { 
      key: 'emp_name', 
      header: 'Employee', 
      render: (row: any) => (
        <div 
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/employees/${row.emp_id}`)}
          title="Click to view analytics & profile"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <strong>{row.emp_name || row.name}</strong>
            {row.active_gate_pass && (
              <span style={{
                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'
              }}>
                🚪 OUT ({row.active_gate_pass.pass_type?.toUpperCase()})
              </span>
            )}
          </div>
          {row.active_gate_pass && (
            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
              Out: {row.active_gate_pass.actual_out_time ? new Date(row.active_gate_pass.actual_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : row.active_gate_pass.expected_out_time}
              {row.active_gate_pass.reason ? ` • "${row.active_gate_pass.reason}"` : ''}
            </div>
          )}
          {Number(row.gate_pass_minutes || 0) > 0 && !row.active_gate_pass && (
            <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
              🎫 Gate Pass: -{Math.floor(row.gate_pass_minutes / 60)}h {row.gate_pass_minutes % 60}m cut
              {row.gate_passes?.length ? ` (${row.gate_passes.map((p: any) => p.reason).filter(Boolean).join(', ')})` : ''}
            </div>
          )}
        </div>
      ) 
    },
    { key: 'dept_name', header: 'Department', render: (row: any) => row.dept_name || row.department_name || '—' },
    { 
      key: 'punch_in', 
      header: 'Punch In', 
      render: (row: any) => row.punch_in ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {new Date(row.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      ) : '—' 
    },
    { 
      key: 'punch_out', 
      header: 'Punch Out', 
      render: (row: any) => {
        if (!row.punch_out && row.punch_in) {
          if (row.active_gate_pass) {
            return (
              <div>
                <span className="badge badge-danger" style={{ fontSize: '10px' }}>🚪 Outside on Pass</span>
                <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px' }}>
                  {row.active_gate_pass.reason}
                </div>
              </div>
            );
          }
          return <span className="badge badge-warning" style={{ fontSize: '10px' }}>🟢 Still Working</span>;
        }
        return row.punch_out ? (
          <div>
            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
              {new Date(row.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {row.punch_in && (() => {
              const rawMins = Math.round((new Date(row.punch_out).getTime() - new Date(row.punch_in).getTime()) / (1000 * 60));
              const effMins = Math.max(0, rawMins - (Number(row.gate_pass_minutes) || 0));
              return (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  ⏱️ {Math.floor(effMins / 60)}h {effMins % 60}m net
                  {Number(row.gate_pass_minutes) > 0 && (
                    <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '3px' }}>
                      (-{row.gate_pass_minutes}m GP)
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        ) : '—';
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: any) => {
        let cls = 'badge-info';
        if (row.status === 'present') cls = 'badge-success';
        if (row.status === 'late') cls = 'badge-warning';
        if (row.status === 'absent') cls = 'badge-danger';
        if (row.status === 'leave') cls = 'badge-info';
        return (
          <div>
            <span className={`badge ${cls}`}>{row.status}</span>
            {row.notes && (row.status === 'leave' || row.status === 'absent') && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {row.notes}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'late_minutes',
      header: 'Late Mins',
      render: (row: any) => Number(row.late_minutes || 0) > 0 ? (
        <span style={{ color: 'var(--warning-color, #e67e22)', fontWeight: 600 }}>
          {row.late_minutes}m
        </span>
      ) : '—'
    },
    {
      key: 'overtime_hours',
      header: 'Overtime',
      render: (row: any) => Number(row.overtime_hours || 0) > 0 ? `${row.overtime_hours} hrs` : '—'
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '130px',
      render: (row: any) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
            onClick={() => navigate(`/employees/${row.emp_id}`)}
            title="View Analytics & Advance Details"
          >
            <Eye size={12} /> Analytics
          </button>
          {hasRole('admin', 'hr', 'manager') && (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}
              onClick={() => {
                setEditingRow(row);
              }}
              title="Edit Punch Time & Attendance"
            >
              <Edit3 size={12} /> Edit
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <Topbar
        title="Attendance Records"
        subtitle={viewMode === 'today' ? "Live today's checks & punch log" : "Monthly historical punch audit"}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {hasRole('admin', 'hr') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '34px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setPunchModalOpen(true)}
              >
                <Clock size={14} /> Punch Attendance
              </button>
            )}

            {/* View Mode Toggle Button Group */}
            <div style={{
              display: 'flex',
              background: 'var(--surface-sunken, #f1f3f5)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                className={`btn ${viewMode === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  boxShadow: viewMode === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
                onClick={() => setViewMode('today')}
              >
                ⚡ Today's Checks
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  boxShadow: viewMode === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
                onClick={() => setViewMode('monthly')}
              >
                📅 Monthly View
              </button>
            </div>

            {viewMode === 'today' ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button 
                  type="button"
                  className={`btn ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: '34px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  title={autoRefresh ? "Auto-refresh is ON - click to pause" : "Auto-refresh is PAUSED - click to enable"}
                >
                  <span>{autoRefresh ? '🟢 Auto-Refresh ON' : '⏸️ Auto-Refresh OFF'}</span>
                </button>

                <button 
                  className="btn btn-secondary" 
                  style={{ height: '34px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => fetchAttendance(false)}
                  title="Refresh Live Data"
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ height: '34px', fontSize: '13px' }}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '80px', height: '34px', fontSize: '13px' }}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>
            )}
          </div>
        }
      />

      <div className="page-container">
        {/* Today's check-ins summary banner */}
        {viewMode === 'today' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              background: 'var(--surface-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Punched In Today
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>
                {records.length}
                {todayMeta?.total_active_employees ? (
                  <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                    / {todayMeta.total_active_employees} active
                  </span>
                ) : null}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                🟢 On-Time Present
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                {todayPresentCount}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                🟡 Late Arrivals
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                {todayLateCount}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                ⏱️ Still Working On Duty
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6', marginTop: '4px' }}>
                {todayStillInCount}
              </div>
            </div>

            <div style={{
              background: 'var(--surface-card, #ffffff)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase' }}>
                🚪 Outside on Pass
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c', marginTop: '4px' }}>
                {todayGatePassCount}
              </div>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={records}
          loading={loading}
          searchPlaceholder={viewMode === 'today' ? "Search today's check-ins..." : "Search employee, date, status..."}
          searchKey={(row) => `${row.emp_name || row.name} ${row.emp_code} ${row.status} ${row.date || ''} ${row.dept_name || row.department_name || ''}`}
        />
        
        {viewMode === 'today' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
            {autoRefresh ? '🟢 Auto-refresh active (silent 30s background update)' : '⏸️ Auto-refresh paused (click Refresh to update manually)'} • Last updated at {lastRefreshed.toLocaleTimeString()}
          </div>
        )}
      </div>

      <EditAttendanceModal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        onSuccess={() => fetchAttendance(false)}
        record={editingRow}
      />

      <ManualPunchModal
        isOpen={punchModalOpen}
        onClose={() => setPunchModalOpen(false)}
        onSuccess={() => fetchAttendance(false)}
      />
    </div>
  );
};

export default AttendancePage;