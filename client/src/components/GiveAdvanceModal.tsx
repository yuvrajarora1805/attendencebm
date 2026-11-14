import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, CheckCircle, Info, X, ShieldAlert, Calendar } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';

interface GiveAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEmpId?: number;
}

export const GiveAdvanceModal: React.FC<GiveAdvanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEmpId
}) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | string>(defaultEmpId || '');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState<string>('cash');
  const [remarks, setRemarks] = useState<string>('');
  const [monthlyDeduction, setMonthlyDeduction] = useState<string>('');
  const [deductionTermType, setDeductionTermType] = useState<'installment' | 'full'>('full');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/employees?status=active').then(res => {
        setEmployees(res.data?.data || []);
      }).catch(err => console.error(err));
      if (defaultEmpId) {
        setSelectedEmpId(defaultEmpId);
      }
    } else {
      setAmount('');
      setRemarks('');
      setSummary(null);
      setError(null);
    }
  }, [isOpen, defaultEmpId]);

  useEffect(() => {
    if (!selectedEmpId) {
      setSummary(null);
      return;
    }
    setLoadingSummary(true);
    api.get(`/advances/summary/${selectedEmpId}`)
      .then(res => {
        setSummary(res.data?.data || null);
        setDeductionTermType('full');
        if (res.data?.data?.monthly_advance_deduction && Number(res.data.data.monthly_advance_deduction) > 0) {
          setMonthlyDeduction(String(res.data.data.monthly_advance_deduction));
        } else {
          setMonthlyDeduction('');
        }
      })
      .catch(err => {
        console.error('Failed to get advance summary', err);
        setSummary(null);
      })
      .finally(() => setLoadingSummary(false));
  }, [selectedEmpId]);

  if (!isOpen) return null;

  const enteredAmount = Number(amount) || 0;
  const maxAdvance = summary?.max_advance_allowed || 0;
  const isOverLimit = enteredAmount > 0 && enteredAmount > maxAdvance;
  const existingDebt = Number(summary?.current_balance || 0);
  const totalCombinedDebt = existingDebt + enteredAmount;
  const isMultiAdvance = existingDebt > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !amount || Number(amount) <= 0) {
      setError('Please select an employee and valid positive amount');
      return;
    }

    const enteredAmt = Number(amount) || 0;
    let finalMonthlyCut = deductionTermType === 'installment' ? (parseFloat(monthlyDeduction) || 0) : 0;
    
    // An installment cannot be greater than or equal to the advance amount.
    // E.g. for ₹300 advance, deducting ₹2000/mo makes no sense — it is recovered fully in 1 upcoming cycle.
    if (finalMonthlyCut >= enteredAmt) {
      finalMonthlyCut = 0;
    }

    const cutNote = finalMonthlyCut > 0 ? `₹${finalMonthlyCut.toLocaleString()}/mo installment` : 'Full deduction in upcoming cycle';

    if (!isAdmin) {
      // Manager submitting advance request for Admin authorization
      try {
        setSaving(true);
        setError(null);
        const res = await api.post('/advances/request', {
          emp_id: selectedEmpId,
          amount: enteredAmt,
          mode,
          monthly_deduction: finalMonthlyCut,
          reason: remarks || (isMultiAdvance 
            ? `Manager requested additional advance (Existing debt: ₹${existingDebt.toLocaleString()}) • Recovery: ${cutNote}` 
            : (isOverLimit ? `Manager requested advance exceeding 50% cap • Recovery: ${cutNote}` : `Manager requested advance • Recovery: ${cutNote}`)
          )
        });
        alert(res.data.message || 'Advance request submitted to Admin for approval!');
        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to submit advance request');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await api.post('/advances', {
        emp_id: selectedEmpId,
        date,
        type: 'given',
        amount: enteredAmt,
        mode,
        remarks: remarks || (isMultiAdvance 
          ? `Additional advance disbursement (${mode}) • Salary cut: ${cutNote}` 
          : `Advance disbursement (${mode}) • Salary cut: ${cutNote}`
        ),
        is_extra_advance: isOverLimit,
        monthly_deduction: finalMonthlyCut
      });
      alert(`Advance successfully recorded! Automated salary deduction set to: ${cutNote}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record advance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '540px', padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#3b82f6', color: '#fff', padding: '8px', borderRadius: '10px' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {isAdmin ? 'Disburse Employee Advance' : 'Request Employee Advance'}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isAdmin ? '50% earned wage limit rule & structured recovery' : 'Manager Request • Submitted to Admin for Approval & Disbursement'}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {!isAdmin && (
          <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '12px', marginBottom: '14px' }}>
            ℹ️ <strong>Manager Request:</strong> Specify the employee and amount. Once submitted, the Administrator will review, approve, and disburse the advance.
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <SearchableEmployeeSelect
            employees={employees}
            value={selectedEmpId}
            onChange={(id) => setSelectedEmpId(id)}
            label="Select Employee (Enter ID / Code)"
            placeholder="Type Employee ID / Code (e.g. 7040)..."
            required
            autoFocus
            requireQuery={true}
          />

          {/* Distinct Warning Indicator for < 6 Months Service */}
          {summary?.is_new_joining && (
            <div style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1.5px solid #f59e0b',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '14px',
              color: '#92400e',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.12)'
            }}>
              <div style={{ background: '#f59e0b', color: '#fff', padding: '6px', borderRadius: '8px', flexShrink: 0 }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️ TENURE NOTICE: WORKED LESS THAN 6 MONTHS</span>
                  <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 6px' }}>
                    &lt; 6M
                  </span>
                </div>
                <div style={{ fontSize: '12px', marginTop: '3px', color: '#78350f', lineHeight: 1.4 }}>
                  Joined: <strong>{summary.joining_date ? summary.joining_date.slice(0, 10) : 'Recent'}</strong> ({Math.max(1, Math.round((summary.tenure_days || 0) / 30))} month(s) service).
                  {isAdmin 
                    ? ' High-risk tenure: Employee has less than 6 months service. Special Admin discretion required before disbursing advance.'
                    : ' High-risk tenure: Employee has worked less than 6 months. This advance request will be highlighted in amber for Admin authorization.'}
                </div>
              </div>
            </div>
          )}

          {/* Live 50% Advance Rule Calculator Info Box */}
          {loadingSummary ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              Checking attendance and 50% eligibility...
            </div>
          ) : summary ? (
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                  ⚡ Live 50% Earned Wage Rule
                </span>
                {summary.is_new_joining && (
                  <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 8px' }}>
                    ⚠️ Worked &lt; 6 Months
                  </span>
                )}
              </div>
              {isAdmin ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>Worked This Month: <strong>{summary.days_worked ?? 0} days</strong></div>
                  <div>Earned So Far: <strong>₹{Number(summary.earned_so_far || 0).toLocaleString()}</strong></div>
                  <div>Standard Cap (50%): <strong style={{ color: '#2563eb' }}>₹{Number(summary.max_advance_allowed || 0).toLocaleString()}</strong></div>
                  <div>Existing Outstanding: <strong style={{ color: Number(summary.current_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>₹{Number(summary.current_balance || 0).toLocaleString()}</strong></div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>Worked This Month: <strong>{summary.days_worked ?? 0} days</strong></div>
                  <div>Existing Debt Balance: <strong style={{ color: Number(summary.current_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>₹{Number(summary.current_balance || 0).toLocaleString()}</strong></div>
                </div>
              )}

              {isOverLimit ? (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 10px',
                  background: isAdmin ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: isAdmin ? '1px solid #facc15' : '1px solid #f87171',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: isAdmin ? '#854d0e' : '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {isAdmin 
                      ? `Exceeds 50% cap by ₹${(enteredAmount - maxAdvance).toLocaleString()}. As Admin, you can authorize this Extra Advance.` 
                      : `Exceeds 50% cap by ₹${(enteredAmount - maxAdvance).toLocaleString()}. This request will be submitted to Admin as an Extra Advance for special approval.`}
                  </span>
                </div>
              ) : (enteredAmount > 0 && maxAdvance > 0) ? (
                <div style={{
                  marginTop: '10px',
                  padding: '6px 10px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>✓ Within standard 50% cap (Eligible up to ₹{maxAdvance.toLocaleString()}).</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Amount & Date Input */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹) *</label>
              <input
                type="number"
                step="any"
                min="1"
                className="form-input"
                placeholder="e.g. 2000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                {isAdmin ? 'Disbursement Date' : 'Request Date'}
              </label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Admin Multi-Advance Notice & Salary Cut Terms */}
          {isAdmin && (
            <div style={{
              background: isMultiAdvance ? '#fffbeb' : '#f8fafc',
              border: isMultiAdvance ? '1px solid #fde68a' : '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px'
            }}>
              {/* Multi-Advance Warning if employee already has active unpaid advance */}
              {isMultiAdvance && (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #fef3c7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 700, fontSize: '13px' }}>
                    <AlertTriangle size={16} /> Multi-Advance: Employee Has Existing Debt
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px', fontSize: '11px', textAlign: 'center' }}>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                      <div style={{ color: '#9a3412', fontWeight: 600 }}>Current Unpaid Debt</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#c2410c' }}>₹{existingDebt.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                      <div style={{ color: '#475569', fontWeight: 600 }}>New Advance</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb' }}>+ ₹{enteredAmount.toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '6px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                      <div style={{ color: '#991b1b', fontWeight: 600 }}>Total Combined Debt</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626' }}>₹{totalCombinedDebt.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Salary Cut Terms Configuration */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#1e293b', marginBottom: '8px' }}>
                  <Calendar size={15} color="#2563eb" /> Automated Salary Cut Terms
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="radio"
                      name="deductionTerm"
                      value="full"
                      checked={deductionTermType === 'full'}
                      onChange={() => setDeductionTermType('full')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>Full Deduction in Upcoming Salary Cycle</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Deduct the full advance amount in the next salary run (up to earned wages).
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    <input
                      type="radio"
                      name="deductionTerm"
                      value="installment"
                      checked={deductionTermType === 'installment'}
                      onChange={() => {
                        setDeductionTermType('installment');
                        if (!monthlyDeduction || (enteredAmount > 0 && parseFloat(monthlyDeduction) >= enteredAmount)) {
                          if (enteredAmount >= 1000) {
                            setMonthlyDeduction(String(Math.min(2000, Math.round(enteredAmount / 2))));
                          } else if (enteredAmount > 0) {
                            setMonthlyDeduction(String(Math.round(enteredAmount / 2)));
                          }
                        }
                      }}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>
                        Fixed Monthly Installments ({isOverLimit ? 'Recommended for Extra Advance' : isMultiAdvance ? 'Recommended for Multi-Advance' : 'Spread across months'})
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Automatically cut a fixed monthly amount from each salary sheet until debt is fully cleared.
                      </div>
                    </div>
                  </label>
                </div>

                {deductionTermType === 'installment' && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e40af' }}>Monthly Salary Cut: ₹</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        max={enteredAmount > 0 ? enteredAmount : undefined}
                        className="form-input"
                        style={{ width: '120px', fontWeight: 700, padding: '4px 8px', height: '32px' }}
                        value={monthlyDeduction}
                        onChange={(e) => setMonthlyDeduction(e.target.value)}
                        placeholder="e.g. 1000"
                      />
                      <span style={{ fontSize: '11px', color: '#1e40af' }}>/ month</span>
                    </div>

                    {enteredAmount > 0 && parseFloat(monthlyDeduction) >= enteredAmount ? (
                      <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 600 }}>
                        ✓ Full ₹{enteredAmount.toLocaleString()} recovered in next 1 month (Single Cycle)
                      </div>
                    ) : totalCombinedDebt > 0 && parseFloat(monthlyDeduction) > 0 ? (
                      <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>
                        Recovers ₹{totalCombinedDebt.toLocaleString()} in ~{Math.ceil(totalCombinedDebt / Math.max(1, parseFloat(monthlyDeduction)))} mo.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Mode only shown for Admin disbursing directly; Hidden for Manager requests */}
          {isAdmin ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Mode</label>
                <select
                  className="form-input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="cash">💵 Cash</option>
                  <option value="bank">🏦 Bank Transfer (NEFT/IMPS)</option>
                  <option value="upi">📱 UPI</option>
                  <option value="cheque">📝 Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Reason / Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Advance disbursement"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Reason / Remarks</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Medical emergency, urgent travel, family need..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving || !selectedEmpId || !amount || Number(amount) <= 0}
            >
              {saving 
                ? (isAdmin ? 'Recording...' : 'Submitting Request...') 
                : (!isAdmin 
                    ? 'Submit Advance Request to Admin' 
                    : (isOverLimit ? 'Authorize Extra Advance' : 'Disburse Advance'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GiveAdvanceModal;
