import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, Clock, AlertCircle, Banknote, ShieldAlert, 
  DollarSign, Send, ArrowRight, FileSpreadsheet, UserPlus, CalendarCheck, Eye, Edit3, X, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Topbar from '../components/Topbar';
import GiveAdvanceModal from '../components/GiveAdvanceModal';
import DisburseSalaryModal from '../components/DisburseSalaryModal';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [data, setData] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for ERP quick actions
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);

  // In-line editing salary approval modal/drawer
  const [editSalaryEmp, setEditSalaryEmp] = useState<any | null>(null);
  const [customBasic, setCustomBasic] = useState<string>('');
  const [approving, setApproving] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/recent-activity')
      ]);
      setData(statsRes.data);
      setRecentLogs(logsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div>
      <Topbar 
        title="Executive Overview & ERP Hub" 
        subtitle="Real-time employee, attendance, advance ledger, and payroll operations" 
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {hasRole('admin', 'hr', 'payroll') && (
              <>
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  onClick={() => setAdvanceModalOpen(true)}
                >
                  <DollarSign size={16} color="#3b82f6" />
                  <span>Give Advance</span>
                </button>

                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  onClick={() => setSalaryModalOpen(true)}
                >
                  <Banknote size={16} />
                  <span>Disburse Salary</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="page-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}><span className="spinner" /> Loading dashboard...</div>
        ) : (
          <>
            {/* Quick ERP Navigation Action Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div 
                className="card"
                style={{ 
                  padding: '14px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-card, #ffffff)'
                }}
                onClick={() => setAdvanceModalOpen(true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Give Advance</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>25% earned limit check</div>
                  </div>
                </div>
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>

              <div 
                className="card"
                style={{ 
                  padding: '14px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-card, #ffffff)'
                }}
                onClick={() => setSalaryModalOpen(true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '8px', borderRadius: '8px' }}>
                    <Banknote size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Disburse Salary</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mark paid & pay slip</div>
                  </div>
                </div>
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>

              <div 
                className="card"
                style={{ 
                  padding: '14px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-card, #ffffff)'
                }}
                onClick={() => navigate('/attendance')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '8px', borderRadius: '8px' }}>
                    <CalendarCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Today's Checks</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Biometric punch monitor</div>
                  </div>
                </div>
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>

              <div 
                className="card"
                style={{ 
                  padding: '14px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-card, #ffffff)'
                }}
                onClick={() => navigate('/employees')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', padding: '8px', borderRadius: '8px' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>Employee Analytics</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Profiles, tenure & leaves</div>
                  </div>
                </div>
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>
            </div>

            {/* Pending Manager Salary Approvals (ADMIN ONLY) */}
            {data?.pending_salary_approvals?.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.04))',
                border: '1.5px solid #ef4444',
                borderRadius: '14px',
                padding: '20px 22px',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#b91c1c' }}>
                        ⚠️ Manager Employee Enrollments: Basic Salary Approval Required ({data.pending_salary_approvals.length})
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        These staff members were registered by managers. Basic salary is held until Admin sign-off.
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 800, padding: '6px 12px' }}>
                    Salary Approval Pending
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                  {data.pending_salary_approvals.map((emp: any) => (
                    <div
                      key={emp.id}
                      style={{
                        background: 'var(--surface-card, #ffffff)',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{emp.name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '13px' }}>({emp.emp_code})</span>
                          {emp.job_role && (
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>{emp.job_role}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          <span>Dept: <strong>{emp.department_name || 'General'}</strong></span>
                          <span>&bull; Enrolled by: <strong>{emp.creator_name || 'Manager'}</strong></span>
                          {emp.joining_date && (
                            <span>&bull; Joined: <strong>{emp.joining_date.slice(0, 10)}</strong></span>
                          )}
                          {emp.phone && (
                            <span>&bull; Phone: <strong>{emp.phone}</strong></span>
                          )}
                          {emp.city_name && (
                            <span>&bull; City: <strong>{emp.city_name}</strong></span>
                          )}
                        </div>
                        {emp.address && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Address: {emp.address}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Reference:{' '}
                          {emp.referred_by_emp_name ? (
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>
                              Colleague: {emp.referred_by_emp_name} ({emp.referred_by_emp_code})
                            </span>
                          ) : emp.referred_by_name ? (
                            <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                              Outside: {emp.referred_by_name} {emp.referred_by_phone ? `(${emp.referred_by_phone})` : ''}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Direct Joining</span>
                          )}
                          {Number(emp.monthly_advance_deduction) > 0 && (
                            <span style={{ marginLeft: '8px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              &bull; Planned Recovery: ₹{Number(emp.monthly_advance_deduction).toLocaleString()}/mo
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', marginTop: '6px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          Proposed Salary: ₹{Number(emp.basic_salary).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)' }}>(₹{Number(emp.salary_per_day).toLocaleString()}/day)</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            setEditSalaryEmp(emp);
                            setCustomBasic(String(emp.basic_salary || ''));
                          }}
                          title="Edit Basic Salary before approving"
                        >
                          <Edit3 size={14} /> Edit & Approve
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', backgroundColor: '#10b981', borderColor: '#10b981' }}
                          onClick={async () => {
                            if (confirm(`Approve Basic Salary of ₹${emp.basic_salary} for ${emp.name}?`)) {
                              try {
                                await api.post(`/employees/${emp.id}/approve-salary`, { basic_salary: emp.basic_salary });
                                alert('Salary approved successfully!');
                                fetchDashboard();
                              } catch (err: any) {
                                alert(err.response?.data?.message || 'Failed to approve salary');
                              }
                            }
                          }}
                        >
                          Quick Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          onClick={() => navigate(`/employees/${emp.id}`)}
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1-Year Completed Increment Alert Card (ADMIN APPROVAL REQUIRED) */}
            {data?.increments_due?.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.06))',
                border: '1.5px solid #f59e0b',
                borderRadius: '14px',
                padding: '20px 22px',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#d97706' }}>
                        🎉 Annual Tenure Increment Approvals ({data.increments_due.length})
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                        Employees eligible for annual tenure increment review.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', fontWeight: 700, padding: '6px 10px', color: '#ef4444', borderColor: '#ef4444' }}
                      onClick={async () => {
                        if (confirm(`Mark 'No Increment' for all ${data.increments_due.length} employee(s) this cycle? Their current salaries will remain unchanged.`)) {
                          try {
                            const res = await api.post('/employees/increments/bulk-action', {
                              action: 'no_increment',
                              emp_ids: data.increments_due.map((e: any) => e.id)
                            });
                            alert(res.data.message);
                            fetchDashboard();
                          } catch (err: any) {
                            alert(err.response?.data?.message || 'Failed to bulk update');
                          }
                        }
                      }}
                    >
                      ✕ No Increment for All
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', fontWeight: 700, padding: '6px 12px' }}
                      onClick={async () => {
                        if (confirm(`Bulk approve standard increment for all ${data.increments_due.length} employee(s)?`)) {
                          try {
                            const res = await api.post('/employees/increments/bulk-action', {
                              action: 'approve',
                              emp_ids: data.increments_due.map((e: any) => e.id)
                            });
                            alert(res.data.message);
                            fetchDashboard();
                          } catch (err: any) {
                            alert(err.response?.data?.message || 'Failed to bulk approve');
                          }
                        }
                      }}
                    >
                      ✓ Approve All ({data.increments_due.length})
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', fontWeight: 700, padding: '6px 10px' }}
                      onClick={async () => {
                        if (confirm(`Confirm annual increment cycle for ${new Date().getFullYear()} is already done? All employee salaries are marked up to date.`)) {
                          try {
                            const res = await api.post('/employees/increments/mark-cycle-done');
                            alert(res.data.message);
                            fetchDashboard();
                          } catch (err: any) {
                            alert(err.response?.data?.message || 'Failed to update cycle');
                          }
                        }
                      }}
                    >
                      ✓ Mark Cycle Done
                    </button>
                    <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 800, padding: '6px 12px' }}>
                      Action Required
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
                  {data.increments_due.map((emp: any) => {
                    const rate = Number(emp.increment_rate || 5);
                    const currentBasic = Number(emp.basic_salary) || 0;
                    const years = Number(emp.completed_years || 1);
                    const nextBasic = Math.round(currentBasic * (1 + rate / 100));

                    return (
                      <div key={emp.id} style={{
                        background: 'var(--surface-color, #1e293b)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                            {emp.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({emp.emp_code})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {emp.department_name} &bull; Tenure: <strong>{years} Year(s)</strong>
                            {emp.joining_date && (
                              <span style={{ marginLeft: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                &bull; Joined: {emp.joining_date.slice(0, 10)}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            Current: <strong>₹{currentBasic.toLocaleString()}</strong> &rarr; Proposed: <strong style={{ color: 'var(--accent-primary)' }}>₹{nextBasic.toLocaleString()}</strong> (+{rate}%)
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}
                            onClick={async () => {
                              if (confirm(`Approve & Apply ${rate}% Annual Increment for ${emp.name}?\nNew Basic Salary: ₹${nextBasic.toLocaleString()}`)) {
                                try {
                                  const res = await api.post('/employees/increments/apply', { emp_id: emp.id, increment_percent: rate });
                                  alert(res.data.message);
                                  fetchDashboard();
                                } catch (err: any) {
                                  alert(err.response?.data?.message || 'Failed to approve increment');
                                }
                              }
                            }}
                          >
                            Approve +{rate}%
                          </button>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 600, flex: 1 }}
                              onClick={async () => {
                                const customVal = prompt(`Enter custom revised Basic Salary for ${emp.name} (Current: ₹${currentBasic}):`, String(nextBasic));
                                if (customVal && !isNaN(Number(customVal)) && Number(customVal) > 0) {
                                  const manualBasic = Number(customVal);
                                  const notes = prompt(`Optional remarks for manual increment:`, 'Manual Increment');
                                  try {
                                    const res = await api.post('/employees/increments/apply', {
                                      emp_id: emp.id,
                                      type: 'manual',
                                      new_basic: manualBasic,
                                      notes
                                    });
                                    alert(res.data.message);
                                    fetchDashboard();
                                  } catch (err: any) {
                                    alert(err.response?.data?.message || 'Failed to apply manual increment');
                                  }
                                }
                              }}
                              title="Enter custom revised salary"
                            >
                              Manual
                            </button>

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 600, color: '#ef4444', borderColor: '#ef4444', flex: 1 }}
                              onClick={async () => {
                                const reason = prompt(`Skip/Waive increment for ${emp.name} this cycle? Enter remarks (optional):`, 'No increment approved for this cycle');
                                if (reason !== null) {
                                  try {
                                    const res = await api.post('/employees/increments/apply', {
                                      emp_id: emp.id,
                                      type: 'no_increment',
                                      notes: reason
                                    });
                                    alert(res.data.message);
                                    fetchDashboard();
                                  } catch (err: any) {
                                    alert(err.response?.data?.message || 'Failed to skip increment');
                                  }
                                }
                              }}
                              title="Do NOT give increment this cycle (salary stays unchanged)"
                            >
                              No Inc
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data?.alerts?.length > 0 && (
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.alerts.map((alert: string, idx: number) => (
                  <div key={idx} className="badge badge-warning" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <AlertCircle size={16} />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Metric KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/employees')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Employees</span>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><Users size={20} /></div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, margin: '10px 0 4px' }}>{data?.employees?.active || 0}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data?.employees?.total || 0} total registered</div>
              </div>

              <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/attendance')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Today's Present</span>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-primary)' }}><CheckCircle size={20} /></div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, margin: '10px 0 4px', color: 'var(--accent-primary)' }}>{data?.attendance?.present || 0}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data?.attendance?.absent || 0} absent, {data?.attendance?.late || 0} late</div>
              </div>

              <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => setAdvanceModalOpen(true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Advances (Month)</span>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Banknote size={20} /></div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, margin: '10px 0 4px' }}>₹{Number(data?.salary?.total_advances || 0).toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>Click to Disburse New &rarr;</div>
              </div>

              <div className="card stat-card" style={{ cursor: 'pointer' }} onClick={() => setSalaryModalOpen(true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Unpaid Payroll</span>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><ShieldAlert size={20} /></div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, margin: '10px 0 4px', color: '#ef4444' }}>₹{Number(data?.salary?.unpaid_salary || 0).toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data?.salary?.unpaid_count || 0} pending payment</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="card">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Department Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(data?.departments || []).map((d: any) => (
                    <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-color)', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{d.name}</span>
                      <span className="badge badge-info">{d.count} active</span>
                    </div>
                  ))}
                  {(!data?.departments || data.departments.length === 0) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No department data available.</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Recent System Activity</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentLogs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <span className="badge badge-info" style={{ marginRight: '8px' }}>{log.action}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{log.reason || log.module}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                  {recentLogs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No audit activity yet.</div>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Give Advance Modal */}
      <GiveAdvanceModal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        onSuccess={fetchDashboard}
      />

      {/* Disburse Salary Modal */}
      <DisburseSalaryModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        onSuccess={fetchDashboard}
      />

      {/* Edit & Approve Salary Modal (Admin Only) */}
      {editSalaryEmp && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Adjust & Approve Salary</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {editSalaryEmp.name} ({editSalaryEmp.emp_code})
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setEditSalaryEmp(null)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '10px', marginBottom: '16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Enrolled by: <strong>{editSalaryEmp.creator_name || 'Manager'}</strong></div>
              <div>Dept: <strong>{editSalaryEmp.department_name || 'General'}</strong> &bull; Role: <strong>{editSalaryEmp.job_role || 'Staff'}</strong></div>
              {editSalaryEmp.joining_date && (
                <div>Date of Joining: <strong>{editSalaryEmp.joining_date.slice(0, 10)}</strong></div>
              )}
              {editSalaryEmp.phone && (
                <div>Contact Phone: <strong>{editSalaryEmp.phone}</strong></div>
              )}
              {editSalaryEmp.address && (
                <div>Residential Address: <strong>{editSalaryEmp.address}</strong></div>
              )}
              <div>
                Reference:{' '}
                {editSalaryEmp.referred_by_emp_name ? (
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>
                    Colleague: {editSalaryEmp.referred_by_emp_name} ({editSalaryEmp.referred_by_emp_code})
                  </span>
                ) : editSalaryEmp.referred_by_name ? (
                  <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                    Outside: {editSalaryEmp.referred_by_name} {editSalaryEmp.referred_by_phone ? `(${editSalaryEmp.referred_by_phone})` : ''}
                  </span>
                ) : (
                  <span>Direct Joining</span>
                )}
              </div>
              <div style={{ marginTop: '4px', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', color: 'var(--accent-primary)' }}>
                Manager Requested Basic: <strong>₹{Number(editSalaryEmp.basic_salary).toLocaleString()}</strong>
              </div>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const num = parseFloat(customBasic);
              if (isNaN(num) || num <= 0) {
                alert('Please enter a valid salary amount');
                return;
              }
              try {
                setApproving(true);
                const perDay = parseFloat((num / 30).toFixed(2));
                await api.post(`/employees/${editSalaryEmp.id}/approve-salary`, {
                  basic_salary: num,
                  salary_per_day: perDay
                });
                alert(`Approved revised salary of ₹${num.toLocaleString()} (₹${perDay}/day) for ${editSalaryEmp.name}`);
                setEditSalaryEmp(null);
                fetchDashboard();
              } catch (err: any) {
                alert(err.response?.data?.message || 'Failed to approve salary');
              } finally {
                setApproving(false);
              }
            }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Approved Monthly Basic Salary (₹) *</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  className="form-input"
                  style={{ fontSize: '16px', fontWeight: 700 }}
                  value={customBasic}
                  onChange={(e) => setCustomBasic(e.target.value)}
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Auto calculates per day rate: <strong>₹{customBasic ? (parseFloat(customBasic) / 30).toFixed(2) : '0'}/day</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditSalaryEmp(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={approving} style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 700 }}>
                  <Check size={16} /> {approving ? 'Approving...' : 'Confirm & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;