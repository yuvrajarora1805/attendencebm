import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Calendar, User, Clock, CheckCircle, XCircle, 
  AlertTriangle, DollarSign, TrendingUp, Award, FileText, ChevronRight, Briefcase, Plus, Banknote
} from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import GiveAdvanceModal from '../components/GiveAdvanceModal';
import DisburseSalaryModal from '../components/DisburseSalaryModal';
import SalarySlipPDF from '../components/SalarySlipPDF';

export const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isManager = hasRole('manager') && !hasRole('admin');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [payslipData, setPayslipData] = useState<any | null>(null);
  const [advanceTab, setAdvanceTab] = useState<'ledger' | 'requests'>('ledger');
  const [advanceFilter, setAdvanceFilter] = useState<'all' | 'given' | 'deduction'>('all');

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/employees/${id}/analytics`);
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load employee analytics');
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || 'Error connecting to analytics server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spin" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
        <div style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading employee profile & analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-container">
        <button className="btn btn-secondary" onClick={() => navigate('/employees')} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back to Employees
        </button>
        <div style={{ padding: '24px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', color: '#991b1b' }}>
          <h4>Error Loading Profile</h4>
          <p>{error || 'Employee not found'}</p>
        </div>
      </div>
    );
  }

  const { employee, this_month, last_month, advance_info, trend, yearly_summary, recent_records, salary_history = [], advance_history = [], advance_requests = [], increments = [] } = data;

  const filteredAdvanceHistory = advance_history.filter((adv: any) => {
    if (advanceFilter === 'all') return true;
    return adv.type === advanceFilter;
  });

  const givenCount = advance_history.filter((adv: any) => adv.type === 'given').length;
  const deductionCount = advance_history.filter((adv: any) => adv.type === 'deduction').length;

  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div>
      <Topbar
        title={`${employee.name} (${employee.emp_code})`}
        subtitle={`${employee.department_name || 'No Dept'} • ${employee.job_role || 'Staff Profile'} • Joined ${employee.joining_date ? employee.joining_date.slice(0, 10) : '—'}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isManager && (
              <button
                className="btn"
                style={{
                  backgroundColor: '#10b981',
                  borderColor: '#10b981',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)'
                }}
                onClick={() => setSalaryModalOpen(true)}
              >
                <Banknote size={16} /> Issue Salary
              </button>
            )}
            {!isManager && (
              <button className="btn btn-primary" onClick={() => setAdvanceModalOpen(true)}>
                <Plus size={16} /> Disburse Advance
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/employees')}>
              <ArrowLeft size={16} /> All Employees
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/attendance')}>
              <Calendar size={16} /> Attendance View
            </button>
          </div>
        }
      />

      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Top Header Card: Summary & Quick Details */}
        <div style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Employee Details</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>{employee.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Code: <strong>{employee.emp_code}</strong></div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📅 Joined:</span> <strong>{employee.joining_date ? employee.joining_date.slice(0, 10) : '—'}</strong>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className={`badge ${employee.status === 'active' ? 'badge-success' : 'badge-danger'}`}
                style={{ cursor: 'pointer', border: 'none', padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Click to toggle Active/Inactive"
                onClick={async () => {
                  const newStatus = employee.status === 'active' ? 'inactive' : 'active';
                  try {
                    await api.patch(`/employees/${employee.id}/status`, { status: newStatus });
                    loadProfile();
                  } catch (err: any) {
                    alert(err.response?.data?.message || 'Failed to update employee status');
                  }
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                {employee.status}
              </button>
              {employee.leaving_date && (
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                  Left: {employee.leaving_date.slice(0, 10)}
                </span>
              )}
              {employee.city_name && (
                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                  📍 {employee.city_name}
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Salary Structure & Approvals</div>
            {isManager ? (
              <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                🔒 <strong>Confidential:</strong> Salary figures and payroll rates are restricted to Admin view.
              </div>
            ) : (
              <>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                  ₹{Number(employee.basic_salary || 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>/ month</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Per Day Rate: <strong>₹{Number(employee.salary_per_day || Math.round(Number(employee.basic_salary || 0) / 30)).toLocaleString()}</strong>
                </div>
                
                {employee.salary_approved === 0 ? (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px' }}>
                      ⚠️ Salary Pending Admin Approval
                    </span>
                    <button
                      className="btn btn-sm"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      onClick={async () => {
                        const revised = prompt(`Edit & Approve Basic Salary for ${employee.name} (Manager requested: ₹${employee.basic_salary}):`, String(employee.basic_salary));
                        if (revised && !isNaN(Number(revised)) && Number(revised) > 0) {
                          const num = Number(revised);
                          const perDay = parseFloat((num / 30).toFixed(2));
                          try {
                            await api.post(`/employees/${employee.id}/approve-salary`, { basic_salary: num, salary_per_day: perDay });
                            alert(`Approved revised salary of ₹${num.toLocaleString()} (₹${perDay}/day)!`);
                            loadProfile();
                          } catch (e: any) {
                            alert(e.response?.data?.message || 'Failed to approve salary');
                          }
                        }
                      }}
                    >
                      Edit & Approve
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      onClick={async () => {
                        if (confirm(`Quick Approve monthly basic salary of ₹${employee.basic_salary} for ${employee.name}?`)) {
                          try {
                            await api.post(`/employees/${employee.id}/approve-salary`, { basic_salary: employee.basic_salary });
                            alert('Salary approved successfully!');
                            loadProfile();
                          } catch (e: any) {
                            alert(e.response?.data?.message || 'Failed to approve salary');
                          }
                        }
                      }}
                    >
                      Quick Approve
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
                    ✓ Salary Approved {employee.salary_approved_by_name ? `by ${employee.salary_approved_by_name}` : ''}
                  </div>
                )}

                {/* Annual / Manual Increment Status & Quick Controls */}
                <div style={{ marginTop: '8px', padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ANNUAL INCREMENT</span>
                    {employee.last_increment_type === 'no_increment' ? (
                      <span className="badge badge-secondary" style={{ fontSize: '10px' }}>No Increment Given</span>
                    ) : employee.last_increment_type === 'manual' ? (
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>✓ Manual Done</span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Up to date</span>
                    )}
                  </div>
                  {employee.last_increment_date && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Last Date: <strong>{String(employee.last_increment_date).slice(0, 10)}</strong>
                      {employee.last_increment_percent !== undefined && Number(employee.last_increment_percent) > 0 && (
                        <span> (+{employee.last_increment_percent}%)</span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', flex: 1 }}
                      onClick={async () => {
                        const curBasic = Number(employee.basic_salary) || 0;
                        const suggested = Math.round(curBasic * 1.05);
                        const val = prompt(`Apply Manual Increment for ${employee.name}:\nCurrent Basic: ₹${curBasic.toLocaleString()}\nEnter new Basic Salary:`, String(suggested));
                        if (val && !isNaN(Number(val)) && Number(val) > 0) {
                          const newBasic = Number(val);
                          const notes = prompt(`Optional remarks / reason:`, 'Manual Salary Increment');
                          try {
                            const res = await api.post('/employees/increments/apply', {
                              emp_id: employee.id,
                              type: 'manual',
                              new_basic: newBasic,
                              notes
                            });
                            alert(res.data.message);
                            loadProfile();
                          } catch (e: any) {
                            alert(e.response?.data?.message || 'Failed to apply manual increment');
                          }
                        }
                      }}
                      title="Set custom revised basic salary"
                    >
                      ✎ Manual Inc
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', color: '#ef4444', borderColor: '#ef4444', flex: 1 }}
                      onClick={async () => {
                        const reason = prompt(`Opt NOT to give increment to ${employee.name} for this cycle?\nEnter reason/notes (optional):`, 'No increment approved for this cycle');
                        if (reason !== null) {
                          try {
                            const res = await api.post('/employees/increments/apply', {
                              emp_id: employee.id,
                              type: 'no_increment',
                              notes: reason
                            });
                            alert(res.data.message);
                            loadProfile();
                          } catch (e: any) {
                            alert(e.response?.data?.message || 'Failed to record decision');
                          }
                        }
                      }}
                      title="Opt not to give increment this cycle (salary remains unchanged)"
                    >
                      ✕ No Inc
                    </button>
                  </div>
                </div>

                {Number(employee.monthly_advance_deduction) > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 600 }}>
                    💳 Monthly Recovery Target: ₹{Number(employee.monthly_advance_deduction).toLocaleString()}/mo
                  </div>
                )}
                {Number(employee.opening_balance) > 0 && (
                  <div style={{ fontSize: '11px', color: '#d97706', marginTop: '2px' }}>
                    Opening Ledger: ₹{Number(employee.opening_balance).toLocaleString()} ({employee.opening_balance_type})
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Contact & Recommendation</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>{employee.job_role || 'Staff'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Dept: {employee.department_name || 'General'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Phone: {employee.phone || '—'}</div>
            {employee.address && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Address: {employee.address}</div>
            )}
            
            <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Referred By: </span>
              {employee.referred_by_emp_name ? (
                <span className="badge badge-info" style={{ fontSize: '11px' }}>
                  Colleague: {employee.referred_by_emp_name} ({employee.referred_by_emp_code})
                </span>
              ) : employee.referred_by_name ? (
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                  Outside: {employee.referred_by_name} {employee.referred_by_phone ? `(${employee.referred_by_phone})` : ''}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Direct Joining</span>
              )}
            </div>
          </div>
        </div>

        {/* Advance Eligibility Calculator Highlight (50% Rule) */}
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '10px' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e3a8a' }}>
                  Advance Eligibility Calculator (50% Rule)
                </h3>
                <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                  Standard eligibility allows up to 50% of earned wages this month. (Extra advance requires Admin term setting)
                </div>
              </div>
            </div>

            {!isManager && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                padding: '8px 16px',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Net Available Advance</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
                  ₹{Number(advance_info?.net_available_advance || 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginTop: '16px'
            }}>
              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Days Worked This Month</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {advance_info?.days_worked_so_far ?? 0} days
                </div>
              </div>

              {!isManager && (
                <>
                  <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Wages Earned So Far</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      ₹{Number(advance_info?.earned_so_far || 0).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Max Standard (50% Cap)</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>
                      ₹{Number(advance_info?.max_expected_advance || 0).toLocaleString()}
                    </div>
                  </div>
                </>
              )}

              <div style={{ background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Existing Unpaid Advance</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: (Number(advance_info?.current_advance_balance || 0) > 0) ? '#dc2626' : '#16a34a' }}>
                  ₹{Number(advance_info?.current_advance_balance || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: Number(advance_info?.current_advance_balance || 0) > 0 ? '#b91c1c' : '#15803d', marginTop: '2px' }}>
                  {Number(advance_info?.current_advance_balance || 0) > 0 ? 'Current Net Outstanding Debt' : '✓ No Outstanding Debt'}
                </div>
              </div>

              {Number(advance_info?.monthly_advance_deduction || 0) > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.85)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Recovery Installment Plan</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8' }}>
                    ₹{Number(advance_info.monthly_advance_deduction).toLocaleString()}/mo
                  </div>
                  {advance_info?.months_to_clear_advance && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Est. {advance_info.months_to_clear_advance} month(s) to clear balance
                    </div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Analytics Grid: Last Month vs Current Month */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Last Month Performance Card */}
          <div style={{
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                📊 Last Month Analytics ({monthNames[last_month.month]} {last_month.year})
              </h4>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>Full Month Audit</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>🟢 Present Days</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>
                  {last_month.present} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
              </div>

              <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>🔴 Net Deductible Leaves</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c' }}>
                  {last_month.final_leaves ?? (last_month.absent + last_month.on_leave)} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: '#991b1b', marginTop: '2px' }}>
                  Raw Absences: {last_month.actual_leaves ?? (last_month.absent + last_month.on_leave)}d
                  {Number(last_month.allowed_paid_leaves) > 0 ? ` (${last_month.allowed_paid_leaves}d allowed/paid)` : ''}
                </div>
              </div>

              <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>🟡 Late Arrivals</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>
                  {last_month.late} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: '#92400e', marginTop: '2px' }}>
                  Treated as: {last_month.late} Late Day(s)
                </div>
              </div>

              <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>⏱️ Overtime Hours & Days</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8' }}>
                  {last_month.overtime_hours} <span style={{ fontSize: '12px', fontWeight: 400 }}>hrs</span>
                </div>
                <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '2px' }}>
                  Equivalent: {(Number(last_month.overtime_hours || 0) / 9).toFixed(1)} Day(s) (9h shift)
                </div>
              </div>
            </div>

            <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total Effective Payable Days: <strong>{last_month.total_present_effective}</strong></span>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
                onClick={() => setSalaryModalOpen(true)}
              >
                <Banknote size={13} /> Settle Salary
              </button>
            </div>
          </div>

          {/* Current Month Progress Card */}
          <div style={{
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                ⚡ Current Month In-Progress ({monthNames[this_month.month]} {this_month.year})
              </h4>
              <span className="badge badge-warning" style={{ fontSize: '11px' }}>Active</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>🟢 Present So Far</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>
                  {this_month.present} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
              </div>

              <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>🔴 Net Deductible Leaves</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c' }}>
                  {this_month.final_leaves ?? (this_month.absent + this_month.on_leave)} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: '#991b1b', marginTop: '2px' }}>
                  Raw Absences: {this_month.actual_leaves ?? (this_month.absent + this_month.on_leave)}d
                  {Number(this_month.allowed_paid_leaves) > 0 ? ` (${this_month.allowed_paid_leaves}d allowed/paid)` : ''}
                </div>
              </div>

              <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>🟡 Late Arrivals</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>
                  {this_month.late} <span style={{ fontSize: '12px', fontWeight: 400 }}>days</span>
                </div>
                <div style={{ fontSize: '10px', color: '#92400e', marginTop: '2px' }}>
                  Treated as: {this_month.late} Late Day(s)
                </div>
              </div>

              <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>⏱️ Overtime Hours & Days</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8' }}>
                  {this_month.overtime_hours} <span style={{ fontSize: '12px', fontWeight: 400 }}>hrs</span>
                </div>
                <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '2px' }}>
                  Equivalent: {(Number(this_month.overtime_hours || 0) / 9).toFixed(1)} Day(s) (9h shift)
                </div>
              </div>
            </div>

            {!isManager && (
              <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                Wages Accumulated So Far: <strong>₹{Number(this_month?.earned_so_far || 0).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 6-Month Attendance Trend Visualizer */}
        <div style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>
            📈 6-Month Presence Trend
          </h4>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', height: '160px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            {trend && trend.length > 0 ? (
              trend.map((t: any, idx: number) => {
                const days = Number(t.present_days || 0);
                const totalWorking = Number(t.working_days) || 30;
                const heightPercent = Math.min(100, Math.round((days / Math.max(1, totalWorking)) * 100));
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: days > 0 ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '4px' }}>
                      {days}/{totalWorking}
                    </div>
                    <div style={{
                      width: '70%',
                      maxWidth: '48px',
                      height: `${Math.max(8, heightPercent)}%`,
                      background: days > 0 ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' : '#e2e8f0',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s'
                    }}></div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {monthNames[t.mo]?.slice(0, 3)} '{String(t.yr).slice(2)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>
                No historical records available for the past 6 months.
              </div>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
            Graph shows Present Days / Total Calendar Days (e.g. 28/30) registered per payroll cycle
          </div>
        </div>

        {/* Recent Attendance Punch Log */}
        <div style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700 }}>
            🕒 Recent Attendance History (Last 30 Records)
          </h4>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>Status</th>
                  <th>Late</th>
                  <th>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {recent_records && recent_records.length > 0 ? (
                  recent_records.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.date?.slice(0, 10)}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {r.punch_in ? new Date(r.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {r.punch_out ? new Date(r.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                          r.punch_in ? <span className="badge badge-warning" style={{ fontSize: '10px' }}>Still In</span> : '—'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          r.status === 'present' ? 'badge-success' :
                          r.status === 'late' ? 'badge-warning' :
                          r.status === 'absent' ? 'badge-danger' : 'badge-info'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{Number(r.late_minutes || 0) > 0 ? `${r.late_minutes}m` : '—'}</td>
                      <td>{Number(r.overtime_hours || 0) > 0 ? `${r.overtime_hours} hrs` : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      No punch records found for this employee
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Advance & Loan Ledger History Section (Protected - Hidden for Managers) */}
        {!isManager && (
        <div style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          {/* Header & Quick Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a' }}>
                <DollarSign size={20} color="#2563eb" />
                Employee Advance & Loan Account
              </h4>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Complete transaction ledger of payouts, salary recoveries, running balance, and request statuses
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                onClick={() => setAdvanceModalOpen(true)}
              >
                <Plus size={14} /> {isManager ? 'Request Advance' : 'Give Advance'}
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/advances')}
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Full Company Ledger <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Advance Metrics Mini-Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Given (Lifetime)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '3px' }}>
                ₹{Number(advance_info?.total_given || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{givenCount} disbursement(s)</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Deducted (Recovered)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803d', marginTop: '3px' }}>
                ₹{Number(advance_info?.total_deducted || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{deductionCount} payroll deduction(s)</div>
            </div>

            <div style={{ 
              background: Number(advance_info?.current_advance_balance || 0) > 0 ? '#fef2f2' : '#f0fdf4', 
              padding: '12px 14px', 
              borderRadius: '10px', 
              border: Number(advance_info?.current_advance_balance || 0) > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0' 
            }}>
              <div style={{ fontSize: '11px', color: Number(advance_info?.current_advance_balance || 0) > 0 ? '#991b1b' : '#166534', textTransform: 'uppercase', fontWeight: 700 }}>
                Current Outstanding Debt
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: Number(advance_info?.current_advance_balance || 0) > 0 ? '#dc2626' : '#16a34a', marginTop: '3px' }}>
                ₹{Number(advance_info?.current_advance_balance || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: Number(advance_info?.current_advance_balance || 0) > 0 ? '#b91c1c' : '#15803d', marginTop: '2px' }}>
                {Number(advance_info?.current_advance_balance || 0) > 0 ? 'Net balance due' : '✓ Cleared (Zero Debt)'}
              </div>
            </div>

            {(Number(advance_info?.total_active_monthly_cut) > 0 || Number(employee.monthly_advance_deduction) > 0) ? (
              <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Salary Cut Term
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '3px' }}>
                  ₹{Number(advance_info?.total_active_monthly_cut || employee.monthly_advance_deduction).toLocaleString()}/mo
                </div>
                <div style={{ fontSize: '10px', color: '#1e40af', marginTop: '2px' }}>
                  {advance_info?.active_cycles?.length > 1
                    ? `Combined across ${advance_info.active_cycles.length} active cycles`
                    : advance_info?.months_to_clear_advance ? `Est. ${advance_info.months_to_clear_advance} mo to clear debt` : 'Fixed monthly recovery'}
                </div>
              </div>
            ) : Number(advance_info?.current_advance_balance || 0) > 0 ? (
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Salary Cut Term
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '5px' }}>
                  Full Salary Cut
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                  Auto-deducted in upcoming payroll
                </div>
              </div>
            ) : null}
          </div>

          {/* Multi-Cycle Advance Breakdown Card (e.g. Cycle 1: 1000/mo, Cycle 2: 2500/mo) */}
          {advance_info?.active_cycles && advance_info.active_cycles.length > 0 && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔄 Active Advance Recovery Cycles ({advance_info.active_cycles.length})
                </span>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>
                  Combined Salary Deduction: ₹{Number(advance_info?.total_active_monthly_cut || 0).toLocaleString()}/mo
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {advance_info.active_cycles.map((cycle: any, idx: number) => {
                  const origAmt = Number(cycle.amount);
                  const termAmt = Number(cycle.monthly_deduction || 0);
                  const remBal = Number(cycle.remaining_balance);
                  const recAmt = Number(cycle.recovered_amount || 0);
                  const estMonths = termAmt > 0 ? Math.ceil(remBal / termAmt) : 1;

                  return (
                    <div 
                      key={cycle.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                          Cycle #{idx + 1} (Adv #{cycle.id})
                        </span>
                        <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '10px', fontWeight: 700 }}>
                          {termAmt > 0 ? `₹${termAmt.toLocaleString()}/mo term` : 'Full cut cycle'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Issued: <strong>{cycle.date ? cycle.date.slice(0, 10) : '—'}</strong> • Principal: <strong>₹{origAmt.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0', fontSize: '11px' }}>
                        <span style={{ color: '#16a34a' }}>Recovered: ₹{recAmt.toLocaleString()}</span>
                        <span style={{ fontWeight: 800, color: remBal > 0 ? '#dc2626' : '#16a34a' }}>
                          Balance: ₹{remBal.toLocaleString()} ({termAmt > 0 ? `~${estMonths} mo` : 'next payroll'})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tabs: Transactions Ledger vs Advance Requests */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${advanceTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', fontWeight: 700 }}
                onClick={() => setAdvanceTab('ledger')}
              >
                📊 Disbursed Ledger ({advance_history?.length || 0})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${advanceTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', fontWeight: 700 }}
                onClick={() => setAdvanceTab('requests')}
              >
                📝 Advance Requests ({advance_requests?.length || 0})
              </button>
            </div>

            {advanceTab === 'ledger' && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${advanceFilter === 'all' ? 'btn-secondary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '2px 8px', fontWeight: advanceFilter === 'all' ? 800 : 500, borderColor: advanceFilter === 'all' ? '#2563eb' : undefined }}
                  onClick={() => setAdvanceFilter('all')}
                >
                  All ({advance_history.length})
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '11px', padding: '2px 8px', fontWeight: advanceFilter === 'given' ? 800 : 500, color: '#dc2626', borderColor: advanceFilter === 'given' ? '#dc2626' : undefined }}
                  onClick={() => setAdvanceFilter('given')}
                >
                  ↗ Given ({givenCount})
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '11px', padding: '2px 8px', fontWeight: advanceFilter === 'deduction' ? 800 : 500, color: '#16a34a', borderColor: advanceFilter === 'deduction' ? '#16a34a' : undefined }}
                  onClick={() => setAdvanceFilter('deduction')}
                >
                  ↙ Deductions ({deductionCount})
                </button>
              </div>
            )}
          </div>

          {/* Tab 1: Disbursed Ledger Table */}
          {advanceTab === 'ledger' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Issue / Cut Date</th>
                    <th>Transaction Type</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Running Debt Balance</th>
                    <th>Payment Mode</th>
                    <th>Origin & Salary Cut Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvanceHistory && filteredAdvanceHistory.length > 0 ? (
                    filteredAdvanceHistory.map((adv: any) => {
                      const isGiven = adv.type === 'given';
                      const isAutoSalaryCut = adv.source_flag === 'SALARY';

                      return (
                        <tr key={adv.id}>
                          <td style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={13} color="var(--text-muted)" />
                              {adv.date ? adv.date.slice(0, 10) : '—'}
                            </span>
                          </td>
                          <td>
                            {isGiven ? (
                              <span className="badge badge-warning" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ↗ Advance Issued
                              </span>
                            ) : isAutoSalaryCut ? (
                              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', fontSize: '11px', padding: '3px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ↙ 🤖 Auto Salary Cut
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ↙ Direct Repayment
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: isGiven ? '#dc2626' : '#16a34a', fontSize: '13px' }}>
                            {isGiven ? `+₹${Number(adv.amount).toLocaleString('en-IN')}` : `-₹${Number(adv.amount).toLocaleString('en-IN')}`}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: Number(adv.balance_after) > 0 ? '#b91c1c' : '#15803d' }}>
                            ₹{Number(adv.balance_after !== undefined ? adv.balance_after : advance_info?.current_advance_balance || 0).toLocaleString()}
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ textTransform: 'uppercase' }}>
                              {adv.mode || (isAutoSalaryCut ? 'PAYROLL' : 'CASH')}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontWeight: 500 }}>
                              {adv.remarks || (isGiven ? 'Advance Disbursed' : isAutoSalaryCut ? 'Automated deduction from monthly salary' : 'Advance Repayment')}
                            </div>
                            {adv.source_flag && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Source: {adv.source_flag === 'SALARY' ? 'Monthly Payroll Finalization' : adv.source_flag === 'MANAGER_REQ_APPROVED' ? 'Approved Manager Request' : adv.source_flag}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No advance transactions recorded for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Advance Requests & Approval History */}
          {advanceTab === 'requests' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Request Date</th>
                    <th>Requested By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Payment Mode</th>
                    <th>Reason / Purpose</th>
                    <th style={{ textAlign: 'center' }}>Admin Status</th>
                    <th>Admin Review & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {advance_requests && advance_requests.length > 0 ? (
                    advance_requests.map((req: any) => {
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';
                      const isPending = req.status === 'pending';

                      return (
                        <tr 
                          key={req.id}
                          style={{
                            background: isApproved ? 'rgba(22, 163, 74, 0.04)' : isRejected ? 'rgba(220, 38, 38, 0.04)' : undefined,
                            borderLeft: isApproved ? '4px solid #16a34a' : isRejected ? '4px solid #dc2626' : '4px solid #f59e0b'
                          }}
                        >
                          <td style={{ fontSize: '12px' }}>{req.created_at ? req.created_at.slice(0, 10) : '—'}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{req.requested_by_name || req.requested_by_username || 'Manager'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-warning)', fontSize: '13px' }}>
                            ₹{Number(req.amount).toLocaleString()}
                          </td>
                          <td><span className="badge badge-info">{req.mode?.toUpperCase() || 'CASH'}</span></td>
                          <td style={{ maxWidth: '240px' }}>
                            <div>{req.reason}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isApproved ? (
                              <span className="badge badge-success" style={{ fontWeight: 800, padding: '3px 8px' }}>
                                ✓ Approved & Disbursed
                              </span>
                            ) : isRejected ? (
                              <span className="badge badge-danger" style={{ fontWeight: 800, padding: '3px 8px' }}>
                                ✕ Rejected by Admin
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontWeight: 800, padding: '3px 8px' }}>
                                ⏳ Pending Review
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '11px' }}>
                            {isApproved ? (
                              <div>
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                  ✓ Authorized {req.reviewed_by_name ? `by ${req.reviewed_by_name}` : ''}
                                </span>
                                {req.admin_notes && <div style={{ color: '#15803d' }}>Note: {req.admin_notes}</div>}
                                {req.reviewed_at && <div style={{ color: 'var(--text-muted)' }}>Date: {req.reviewed_at.slice(0, 10)}</div>}
                              </div>
                            ) : isRejected ? (
                              <div>
                                <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                  ✕ Declined {req.reviewed_by_name ? `by ${req.reviewed_by_name}` : ''}
                                </span>
                                {req.admin_notes && <div style={{ color: '#991b1b' }}>Reason: {req.admin_notes}</div>}
                                {req.reviewed_at && <div style={{ color: 'var(--text-muted)' }}>Date: {req.reviewed_at.slice(0, 10)}</div>}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting Admin action</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No advance requests submitted for this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Salary Sheet History Section (Protected & Released View) */}
        <div style={{
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={18} color="var(--primary-600)" />
                Salary Sheet History
              </h4>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {isManager 
                  ? 'Official released salary cycles approved and published by Admin'
                  : 'Complete monthly payroll ledger, deductions, bonuses and payslips'
                }
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/salary')}
                style={{ fontSize: '12px' }}
              >
                Open Full Salary Sheet <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Cycle Period</th>
                  <th style={{ textAlign: 'right' }}>Basic Salary</th>
                  <th style={{ textAlign: 'center' }}>Present Days</th>
                  <th style={{ textAlign: 'center' }}>Leaves Ded.</th>
                  <th style={{ textAlign: 'right' }}>Advance Ded.</th>
                  <th style={{ textAlign: 'right' }}>Incentives / Bonus</th>
                  <th style={{ textAlign: 'right' }}>Net Payable Gross</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Slip</th>
                </tr>
              </thead>
              <tbody>
                {salary_history && salary_history.length > 0 ? (
                  salary_history.map((s: any) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>
                        {monthNames[s.month]} {s.year}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹{Number(s.basic_salary || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          {s.present_days}d
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: Number(s.leaves_amount || 0) > 0 ? '#b91c1c' : 'inherit' }}>
                        {Number(s.final_leaves || 0) > 0 ? `${s.final_leaves}d (-₹${Number(s.leaves_amount).toLocaleString('en-IN')})` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: Number(s.advance_deduction || 0) > 0 ? '#b91c1c' : 'inherit' }}>
                        {Number(s.advance_deduction || 0) > 0 ? `-₹${Number(s.advance_deduction).toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td style={{ textAlign: 'right', color: Number(s.other_incentives || 0) > 0 ? '#15803d' : 'inherit' }}>
                        {Number(s.other_incentives || 0) > 0 ? `+₹${Number(s.other_incentives).toLocaleString('en-IN')}` : '—'}
                        {s.incentive_remarks && (
                          <div style={{ fontSize: '10px', color: '#15803d' }}>{s.incentive_remarks}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary-700)', fontSize: '14px' }}>
                        ₹{Number(s.gross_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.paid ? (
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>Paid</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '10px' }}>Unpaid</span>
                        )}
                        {Boolean(s.is_released) && (
                          <div style={{ fontSize: '9px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
                            ✓ Admin Released
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '3px 8px' }}
                          onClick={() => setPayslipData({ ...s, emp_name: employee.name, emp_code: employee.emp_code, department: employee.department_name })}
                          title="View Official Payslip"
                        >
                          <FileText size={13} color="var(--primary-600)" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      {isManager 
                        ? 'No released salary sheets found for this employee yet. Records will display once released by Admin.'
                        : 'No salary cycle entries generated for this employee yet.'
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Increment & Salary Revision History */}
        {!isManager && increments && increments.length > 0 && (
          <div style={{
            background: 'var(--surface-card, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>
                  📈 Salary Revision & Increment History ({increments.length})
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Audit log of annual tenure increments, manual adjustments, and cycle decisions
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Effective Date</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Old Basic</th>
                    <th style={{ textAlign: 'right' }}>New Basic</th>
                    <th style={{ textAlign: 'right' }}>Increment</th>
                    <th>Reason / Notes</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {increments.map((inc: any) => {
                    const diff = Number(inc.new_basic) - Number(inc.old_basic);
                    return (
                      <tr key={inc.id}>
                        <td style={{ fontWeight: 600 }}>{inc.effective_date ? String(inc.effective_date).slice(0, 10) : '—'}</td>
                        <td>
                          {inc.type === 'no_increment' ? (
                            <span className="badge badge-secondary" style={{ fontSize: '10px' }}>No Increment</span>
                          ) : inc.type === 'manual' ? (
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>Manual Revision</span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>Annual Tenure</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{Number(inc.old_basic).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(inc.new_basic).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: diff > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {diff > 0 ? `+₹${diff.toLocaleString()} (${inc.increment_percent}%)` : '₹0 (0%)'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{inc.notes || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{inc.creator_name || 'System Admin'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <GiveAdvanceModal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        onSuccess={loadProfile}
        defaultEmpId={Number(id)}
      />

      <DisburseSalaryModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        onSuccess={loadProfile}
        defaultSearchTerm={employee.emp_code || employee.name}
      />

      <SalarySlipPDF
        isOpen={payslipData !== null}
        onClose={() => setPayslipData(null)}
        data={payslipData}
      />
    </div>
  );
};

export default EmployeeProfilePage;
