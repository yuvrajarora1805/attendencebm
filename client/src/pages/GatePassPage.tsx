import React, { useState, useEffect } from 'react';
import { 
  DoorOpen, Clock, Calendar, Search, Plus, RefreshCw, AlertTriangle, 
  CheckCircle2, XCircle, Printer, Filter, Briefcase, HeartPulse, UserX, ArrowRight
} from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import ApplyGatePassModal from '../components/ApplyGatePassModal';
import { useAuth } from '../context/AuthContext';

export const GatePassPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [date, setDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [activeTab, setActiveTab] = useState<'all' | 'out' | 'approved' | 'completed' | 'official' | 'personal'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [gatePasses, setGatePasses] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total_today: 0,
    currently_outside: 0,
    completed_count: 0,
    official_visits: 0,
    total_minutes_cut: 0,
    total_hours_cut: 0
  });

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [printPass, setPrintPass] = useState<any | null>(null);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      const [recentRes, listRes] = await Promise.all([
        api.get(`/gate-pass/recent?date=${date}`),
        api.get(`/gate-pass?date=${date}&limit=100`)
      ]);

      if (recentRes.data?.stats) {
        setStats(recentRes.data.stats);
      }
      setGatePasses(listRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load gate passes:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [date]);

  // Periodic 20s auto-refresh for live gate status
  useEffect(() => {
    const timer = setInterval(() => loadData(true), 20000);
    return () => clearInterval(timer);
  }, [date]);

  // Handle Gate OUT action
  const handleMarkOut = async (id: number, empName: string) => {
    if (!window.confirm(`Record gate EXIT for ${empName}?`)) return;
    try {
      setActionLoadingId(id);
      await api.post(`/gate-pass/${id}/out`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record gate exit');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Gate IN (Return) action
  const handleMarkIn = async (id: number, empName: string) => {
    if (!window.confirm(`Record gate RETURN for ${empName}? This will calculate away time and cut from shift if personal.`)) return;
    try {
      setActionLoadingId(id);
      const res = await api.post(`/gate-pass/${id}/in`);
      alert(`✅ ${res.data.message || 'Gate return recorded successfully'}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record gate return');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete / Cancel
  const handleDelete = async (id: number, passNum: string) => {
    if (!window.confirm(`Delete Gate Pass ${passNum}? Any shift deductions will be reversed.`)) return;
    try {
      setActionLoadingId(id);
      await api.delete(`/gate-pass/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete gate pass');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered passes
  const filteredPasses = gatePasses.filter(gp => {
    // Tab filter
    if (activeTab === 'out' && gp.status !== 'out') return false;
    if (activeTab === 'approved' && gp.status !== 'approved' && gp.status !== 'pending') return false;
    if (activeTab === 'completed' && gp.status !== 'completed') return false;
    if (activeTab === 'official' && gp.pass_type !== 'official') return false;
    if (activeTab === 'personal' && gp.pass_type !== 'personal') return false;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = gp.emp_name?.toLowerCase().includes(q) || gp.name?.toLowerCase().includes(q);
      const matchCode = gp.emp_code?.toLowerCase().includes(q);
      const matchPass = gp.pass_number?.toLowerCase().includes(q);
      const matchReason = gp.reason?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchPass && !matchReason) return false;
    }
    return true;
  });

  return (
    <div>
      <Topbar
        title="Gate Pass Management"
        subtitle="Authorize staff gate exits with automatic shift deduction tracking"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '140px', padding: '6px 10px', fontSize: '12px' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadData()}
              disabled={loading}
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
            {hasRole('admin', 'hr', 'manager', 'security_guard', 'guard') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setApplyModalOpen(true)}
                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Issue Gate Pass
              </button>
            )}
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '18px' }}>
        {/* Currently Outside */}
        <div
          className="card"
          onClick={() => setActiveTab('out')}
          style={{
            cursor: 'pointer',
            padding: '14px',
            borderRadius: '12px',
            border: activeTab === 'out' ? '2px solid #dc2626' : '1px solid #fee2e2',
            background: stats.currently_outside > 0 ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)' : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>🚪 CURRENTLY OUTSIDE</span>
            <span style={{ background: '#fecdd3', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 800, color: '#9f1239' }}>
              Live
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#991b1b', marginTop: '6px' }}>
            {stats.currently_outside}
          </div>
          <div style={{ fontSize: '11px', color: '#be123c', marginTop: '2px' }}>
            Employees out through factory gate
          </div>
        </div>

        {/* Shift Time Cut Today */}
        <div
          className="card"
          onClick={() => setActiveTab('personal')}
          style={{
            cursor: 'pointer',
            padding: '14px',
            borderRadius: '12px',
            border: activeTab === 'personal' ? '2px solid #ea580c' : '1px solid #ffedd5',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#c2410c' }}>✂️ SHIFT TIME CUT TODAY</span>
            <Clock size={15} style={{ color: '#ea580c' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#9a3412', marginTop: '6px' }}>
            {stats.total_hours_cut} hrs
          </div>
          <div style={{ fontSize: '11px', color: '#c2410c', marginTop: '2px' }}>
            {stats.total_minutes_cut} total minutes deducted
          </div>
        </div>

        {/* Total Today */}
        <div
          className="card"
          onClick={() => setActiveTab('all')}
          style={{
            cursor: 'pointer',
            padding: '14px',
            borderRadius: '12px',
            border: activeTab === 'all' ? '2px solid #0284c7' : '1px solid #e2e8f0',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1' }}>📋 TOTAL GATE PASSES</span>
            <DoorOpen size={15} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
            {stats.total_today}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {stats.completed_count} completed returns
          </div>
        </div>

        {/* Official Visits */}
        <div
          className="card"
          onClick={() => setActiveTab('official')}
          style={{
            cursor: 'pointer',
            padding: '14px',
            borderRadius: '12px',
            border: activeTab === 'official' ? '2px solid #16a34a' : '1px solid #dcfce7',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d' }}>🏢 OFFICIAL VISITS</span>
            <Briefcase size={15} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534', marginTop: '6px' }}>
            {stats.official_visits}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
            Paid company work (0h cut)
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: '14px', borderRadius: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Passes', count: gatePasses.length },
              { id: 'out', label: '🚪 Outside', count: stats.currently_outside },
              { id: 'approved', label: '⏳ Approved/Pending', count: gatePasses.filter(p => p.status === 'approved' || p.status === 'pending').length },
              { id: 'completed', label: '✅ Returned', count: stats.completed_count },
              { id: 'official', label: '🏢 Official', count: stats.official_visits },
              { id: 'personal', label: '👤 Personal', count: gatePasses.filter(p => p.pass_type === 'personal').length }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: activeTab === tab.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: activeTab === tab.id ? '#0284c7' : '#ffffff',
                  color: activeTab === tab.id ? '#ffffff' : '#475569',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '10px'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search code, name, pass #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '12px' }}
            />
          </div>
        </div>
      </div>

      {/* Gate Pass Table */}
      <div className="card" style={{ padding: 0, borderRadius: '14px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Pass #</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Type</th>
                <th>Expected Timings</th>
                <th>Actual Gate Time</th>
                <th>Duration / Shift Cut</th>
                <th>Reason / Remarks</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '170px' }}>Gate Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPasses.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    <DoorOpen size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No gate passes found for {date}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px' }}>Click "Issue Gate Pass" above to authorize an employee exit.</p>
                  </td>
                </tr>
              ) : (
                filteredPasses.map((pass) => {
                  const isOut = pass.status === 'out';
                  const isCompleted = pass.status === 'completed';
                  const isApproved = pass.status === 'approved' || pass.status === 'pending';

                  const formatTimeStr = (t: string | null) => {
                    if (!t) return '—';
                    if (t.includes('T')) {
                      return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    const [h, m] = t.split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
                  };

                  const awayHrs = Math.floor((pass.total_minutes || 0) / 60);
                  const awayMins = (pass.total_minutes || 0) % 60;
                  const awayText = pass.total_minutes > 0 ? `${awayHrs > 0 ? awayHrs + 'h ' : ''}${awayMins}m` : '—';

                  return (
                    <tr key={pass.id} style={{ background: isOut ? '#fff5f5' : 'transparent' }}>
                      {/* Pass # */}
                      <td>
                        <strong style={{ color: '#0284c7', fontSize: '12px', letterSpacing: '0.02em' }}>
                          {pass.pass_number}
                        </strong>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {pass.date?.slice(0, 10)}
                        </div>
                      </td>

                      {/* Employee */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {pass.emp_name || pass.name}
                        </div>
                        <span style={{
                          background: '#f1f5f9',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#1d4ed8'
                        }}>
                          {pass.emp_code}
                        </span>
                      </td>

                      {/* Dept */}
                      <td style={{ fontSize: '12px', color: '#475569' }}>
                        {pass.department_name || pass.dept_name || 'Staff'}
                      </td>

                      {/* Pass Type */}
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: pass.pass_type === 'official' ? '#dcfce7' : pass.pass_type === 'emergency' ? '#fee2e2' : '#e0f2fe',
                          color: pass.pass_type === 'official' ? '#15803d' : pass.pass_type === 'emergency' ? '#dc2626' : '#0369a1'
                        }}>
                          {pass.pass_type === 'official' ? '🏢 Official' : pass.pass_type === 'emergency' ? '🚨 Emergency' : '👤 Personal'}
                        </span>
                      </td>

                      {/* Expected */}
                      <td style={{ fontSize: '12px' }}>
                        <div style={{ color: '#dc2626', fontWeight: 600 }}>
                          Out: {formatTimeStr(pass.expected_out_time)}
                        </div>
                        <div style={{ color: '#0284c7', fontSize: '11px' }}>
                          In: {formatTimeStr(pass.expected_in_time)}
                        </div>
                      </td>

                      {/* Actual */}
                      <td style={{ fontSize: '12px' }}>
                        {pass.actual_out_time ? (
                          <div style={{ color: '#991b1b', fontWeight: 700 }}>
                            🚪 Out: {formatTimeStr(pass.actual_out_time)}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Not exited yet</span>
                        )}
                        {pass.actual_in_time && (
                          <div style={{ color: '#16a34a', fontWeight: 700 }}>
                            🟢 In: {formatTimeStr(pass.actual_in_time)}
                          </div>
                        )}
                      </td>

                      {/* Duration / Shift Cut */}
                      <td>
                        {pass.total_minutes > 0 ? (
                          <div>
                            <strong style={{ fontSize: '12px', color: '#0f172a' }}>
                              ⏱️ {awayText}
                            </strong>
                            <div>
                              {pass.is_deductible ? (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  color: '#dc2626',
                                  background: '#fee2e2',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  ✂️ -{pass.total_minutes}m cut from shift
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: '#16a34a',
                                  background: '#dcfce7',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}>
                                  ✓ Paid Official
                                </span>
                              )}
                            </div>
                          </div>
                        ) : isOut ? (
                          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                            ⏳ Away (Tracking...)
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Pending exit</span>
                        )}
                      </td>

                      {/* Reason / Remarks */}
                      <td style={{ maxWidth: '200px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: '#1e293b' }}>
                          {pass.reason}
                        </div>
                        {pass.notes && (
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            Note: {pass.notes}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {isOut ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            🚪 OUTSIDE
                          </span>
                        ) : isCompleted ? (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={12} /> Returned
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: '#fef3c7',
                            color: '#b45309'
                          }}>
                            ⏳ Approved
                          </span>
                        )}
                      </td>

                      {/* Gate Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => handleMarkOut(pass.id, pass.emp_name || pass.name)}
                              disabled={actionLoadingId === pass.id}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '5px',
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Record Gate Exit"
                            >
                              🚪 Gate OUT
                            </button>
                          )}

                          {isOut && (
                            <button
                              type="button"
                              onClick={() => handleMarkIn(pass.id, pass.emp_name || pass.name)}
                              disabled={actionLoadingId === pass.id}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '5px',
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Record Gate Return"
                            >
                              🟢 Gate IN
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setPrintPass(pass)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '5px',
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer'
                            }}
                            title="Print / View Gate Slip"
                          >
                            <Printer size={12} />
                          </button>

                          {hasRole('admin', 'hr', 'manager') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(pass.id, pass.pass_number)}
                              disabled={actionLoadingId === pass.id}
                              style={{
                                padding: '4px 6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '5px',
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                cursor: 'pointer'
                              }}
                              title="Delete gate pass"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Gate Pass Modal */}
      <ApplyGatePassModal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        onSuccess={() => loadData()}
        defaultDate={date}
      />

      {/* Printable Gate Slip Preview Modal */}
      {printPass && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setPrintPass(null);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.04em' }}>ATTENDPRO GATE PASS SLIP</h2>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>FACTORY & SECURITY GATE PERMIT</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                {printPass.pass_number}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
              <div><strong>Date:</strong> {printPass.date?.slice(0, 10)}</div>
              <div><strong>Type:</strong> {printPass.pass_type?.toUpperCase()}</div>
              <div><strong>Employee:</strong> {printPass.emp_name || printPass.name}</div>
              <div><strong>Emp Code:</strong> {printPass.emp_code}</div>
              <div><strong>Department:</strong> {printPass.department_name || printPass.dept_name || 'Staff'}</div>
              <div><strong>Deduction:</strong> {printPass.is_deductible ? 'Yes (Personal Work)' : 'No (Official Duty)'}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '4px' }}><strong>Purpose / Reason:</strong></div>
              <div style={{ color: '#0f172a', fontWeight: 600 }}>{printPass.reason}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <div><strong>Expected Out:</strong> {printPass.expected_out_time}</div>
              <div><strong>Expected In:</strong> {printPass.expected_in_time || '—'}</div>
              <div><strong>Actual Out:</strong> {printPass.actual_out_time ? new Date(printPass.actual_out_time).toLocaleTimeString() : '—'}</div>
              <div><strong>Actual In:</strong> {printPass.actual_in_time ? new Date(printPass.actual_in_time).toLocaleTimeString() : '—'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                Authorized Supervisor Signature
              </div>
              <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}>
                Security Guard Signature
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setPrintPass(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Printer size={13} /> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatePassPage;
