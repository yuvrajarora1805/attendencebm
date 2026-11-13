import React, { useState, useEffect } from 'react';
import { Lock, Unlock, RefreshCw } from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import SalaryTable from './SalaryTable';
import SalarySlipPDF from '../components/SalarySlipPDF';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export const SalaryPage: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');
  const [payslipData, setPayslipData] = useState<any | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') && !isAdmin;

  const loadPeriods = async () => {
    try {
      const res = await api.get('/salary/periods');
      const list = res.data?.data || [];
      setPeriods(list);
      if (list.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load salary periods', err);
    }
  };

  const loadEntries = async (periodId: number, status = statusFilter) => {
    try {
      setLoading(true);
      const res = await api.get(`/salary/periods/${periodId}/entries?status=${status}`);
      setEntries(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load salary entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => {
    if (selectedPeriodId) loadEntries(selectedPeriodId, statusFilter);
  }, [selectedPeriodId, statusFilter]);

  const currentPeriod = periods.find(p => p.id === selectedPeriodId);
  const isLocked = Boolean(currentPeriod?.is_locked);
  const isReleased = Boolean(currentPeriod?.is_released);

  const handleEntryChange = (id: number, field: string, value: number) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      const updated = { ...entry, [field]: value };
      if (field === 'basic_salary') {
        updated.basic_salary = value;
        updated.salary_per_day = parseFloat((value / 30).toFixed(2));
      }
      const leavesAmount = updated.final_leaves * updated.salary_per_day;
      const advanceCf = updated.op_balance + updated.advance_given - updated.advance_deduction;
      const netSalary = updated.basic_salary - leavesAmount - updated.other_deduction + updated.other_incentives;
      const grossAmount = netSalary - updated.advance_deduction;

      return {
        ...updated,
        leaves_amount: leavesAmount,
        advance_cf: advanceCf,
        net_salary: netSalary,
        gross_amount: Math.max(0, grossAmount),
      };
    }));
  };

  const handleSaveRow = async (row: any) => {
    try {
      await api.put(`/salary/entries/${row.id}`, row);
      alert(`Saved salary for ${row.emp_name || row.emp_code} (Basic: ₹${row.basic_salary}, Net: ₹${Number(row.gross_amount).toFixed(0)})`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save row');
    }
  };

  const handleGenerate = async () => {
    if (!selectedPeriodId) return;
    try {
      setLoading(true);
      await api.post(`/salary/periods/${selectedPeriodId}/generate`);
      loadEntries(selectedPeriodId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async (reason: string) => {
    if (!selectedPeriodId) return;
    try {
      await api.post(`/salary/periods/${selectedPeriodId}/finalize`, { reason });
      setLockDialogOpen(false);
      loadPeriods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to finalize period');
    }
  };

  const handleUnlock = async (reason: string) => {
    if (!selectedPeriodId) return;
    try {
      setLoading(true);
      const res = await api.post(`/salary/periods/${selectedPeriodId}/unlock`, { reason });
      alert(res.data.message || 'Salary period unlocked successfully');
      setUnlockDialogOpen(false);
      await loadPeriods();
      await loadEntries(selectedPeriodId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unlock period');
    } finally {
      setLoading(false);
    }
  };

  const summary = entries.reduce((acc, r) => {
    acc.totalBasic += Number(r.basic_salary || 0);
    acc.totalAdvDed += Number(r.advance_deduction || 0);
    acc.totalNet += Number(r.gross_amount || 0);
    return acc;
  }, { totalBasic: 0, totalAdvDed: 0, totalNet: 0 });

  return (
    <div>
      <Topbar
        title="Monthly Salary Calculation"
        subtitle="Professional billing ledger with editable salary, advance deductions and 1-click payslips"
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ height: '34px', fontSize: '13px' }}
              value={selectedPeriodId || ''}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.month}/{p.year} {p.is_locked ? '🔒 (Locked)' : '✏️ (Draft)'} {p.is_released ? '📢 (Released)' : ''}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              style={{ height: '34px', fontSize: '13px', width: '160px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              title="Filter employees by active/inactive status"
            >
              <option value="active">🟢 Active Staff Only</option>
              <option value="all">👥 All Staff (Inc. Inactive)</option>
              <option value="inactive">🔴 Inactive Staff Only</option>
            </select>

            {!isLocked && hasRole('admin', 'payroll') && (
              <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading}>
                <RefreshCw size={14} /> Calculate / Sync
              </button>
            )}

            {/* Admin Release / Unrelease Controls - Available at all times */}
            {isAdmin && (
              <>
                {!isReleased ? (
                  <button 
                    className="btn btn-secondary" 
                    style={{ color: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
                    onClick={async () => {
                      if (confirm(`Release salary sheet for period ${currentPeriod?.month}/${currentPeriod?.year} so Managers and Staff can view finalized figures?`)) {
                        try {
                          const res = await api.post(`/salary/periods/${selectedPeriodId}/release`);
                          alert(res.data.message);
                          loadPeriods();
                          loadEntries(selectedPeriodId!);
                        } catch (e: any) {
                          alert(e.response?.data?.message || 'Failed to release salary sheet');
                        }
                      }
                    }} 
                    disabled={loading}
                  >
                    📢 Release Sheet
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-success" style={{ fontSize: '11px', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✓ Released to Managers
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 8px', color: '#b91c1c' }}
                      title="Withdraw release so managers cannot view this sheet"
                      onClick={async () => {
                        if (confirm(`Withdraw release for period ${currentPeriod?.month}/${currentPeriod?.year}? Managers will no longer see these salary records until re-released.`)) {
                          try {
                            const res = await api.post(`/salary/periods/${selectedPeriodId}/unrelease`);
                            alert(res.data.message);
                            loadPeriods();
                            loadEntries(selectedPeriodId!);
                          } catch (e: any) {
                            alert(e.response?.data?.message || 'Failed to withdraw release');
                          }
                        }
                      }}
                      disabled={loading}
                    >
                      Withdraw
                    </button>
                  </div>
                )}
              </>
            )}

            {!isLocked && isAdmin && (
              <button className="btn btn-primary" onClick={() => setLockDialogOpen(true)}>
                <Lock size={14} /> Finalize Period
              </button>
            )}

            {isLocked && isAdmin && (
              <button
                className="btn btn-secondary"
                style={{
                  borderColor: '#f59e0b',
                  color: '#b45309',
                  background: '#fef3c7',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => setUnlockDialogOpen(true)}
                disabled={loading}
              >
                <Unlock size={14} /> Unlock Period
              </button>
            )}
          </div>
        }
      />

      <div className="page-container">
        {/* Professional Billing Summary Banner */}
        <div className="billing-kpi-banner">
          <div className="billing-kpi-card">
            <span className="billing-kpi-title">
              {statusFilter === 'active' ? 'Active Payroll Workforce' : statusFilter === 'inactive' ? 'Inactive Workforce' : 'Total Payroll Workforce'}
            </span>
            <span className="billing-kpi-val">{entries.length} Staff</span>
          </div>
          <div className="billing-kpi-card">
            <span className="billing-kpi-title">Total Basic Payroll</span>
            <span className="billing-kpi-val">₹{summary.totalBasic.toLocaleString('en-IN')}</span>
          </div>
          <div className="billing-kpi-card">
            <span className="billing-kpi-title">Advance Deductions</span>
            <span className="billing-kpi-val" style={{ color: 'var(--accent-danger)' }}>
              -₹{summary.totalAdvDed.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="billing-kpi-card" style={{ borderLeft: '4px solid var(--primary-600)' }}>
            <span className="billing-kpi-title">Net Disbursed Payout</span>
            <span className="billing-kpi-val" style={{ color: 'var(--primary-700)' }}>
              ₹{summary.totalNet.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {isLocked && (
          <div
            className="badge badge-warning"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #fde68a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} />
              <div>
                <strong style={{ display: 'block' }}>This salary period has been finalized and locked.</strong>
                <span style={{ fontSize: '12px', opacity: 0.9 }}>
                  {isAdmin
                    ? 'Edits are frozen for compliance. As an Administrator, you can unlock this period to adjust salary entries or re-calculate attendance.'
                    : 'Edits are disabled for compliance. Contact an Administrator if revisions are needed.'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <button
                className="btn btn-secondary"
                style={{
                  background: '#ffffff',
                  color: '#b45309',
                  border: '1px solid #d97706',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '6px 14px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setUnlockDialogOpen(true)}
                disabled={loading}
              >
                <Unlock size={14} /> Unlock Period
              </button>
            )}
          </div>
        )}

        {isManager && !isReleased ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid #fde68a', borderRadius: '12px' }}>
            <Lock size={36} color="#d97706" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
              Salary Sheet Pending Admin Release
            </h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto', fontSize: '13px', lineHeight: '1.6' }}>
              The salary calculation for period <strong>{currentPeriod ? `${currentPeriod.month}/${currentPeriod.year}` : ''}</strong> has not been officially released by the Administrator yet. Figures will display here automatically once the Admin releases the sheet.
            </p>
          </div>
        ) : (
          <SalaryTable
            entries={entries}
            isLocked={isLocked || isManager}
            onEntryChange={handleEntryChange}
            onSaveRow={handleSaveRow}
            onViewPayslip={(row) => setPayslipData({ ...row, month: currentPeriod?.month, year: currentPeriod?.year })}
          />
        )}
      </div>

      <SalarySlipPDF
        isOpen={payslipData !== null}
        onClose={() => setPayslipData(null)}
        data={payslipData}
      />

      <ConfirmDialog
        isOpen={lockDialogOpen}
        title="Finalize & Lock Salary Period"
        message="Locking this period will freeze all attendance deductions and salary values. An administrator can unlock it later if revisions are needed."
        confirmText="Finalize & Lock"
        requireReason={true}
        onConfirm={handleFinalize}
        onCancel={() => setLockDialogOpen(false)}
      />

      <ConfirmDialog
        isOpen={unlockDialogOpen}
        title="Unlock Salary Period"
        message={`Are you sure you want to unlock salary period ${currentPeriod?.month}/${currentPeriod?.year}? Unlocking will return it to Draft status, enabling edits, recalculation, and resyncing.`}
        confirmText="Unlock Period"
        requireReason={true}
        onConfirm={handleUnlock}
        onCancel={() => setUnlockDialogOpen(false)}
      />
    </div>
  );
};

export default SalaryPage;
