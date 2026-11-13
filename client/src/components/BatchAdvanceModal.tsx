import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, DollarSign, Search, CheckSquare, Square, AlertTriangle, 
  History, Send, CheckCircle2, ShieldAlert, Filter, User
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AdvanceHistoryModal from './AdvanceHistoryModal';

interface BatchAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchAdvanceModal: React.FC<BatchAdvanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Selection & Custom Values
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [customAmounts, setCustomAmounts] = useState<{ [id: number]: string }>({});
  const [customReasons, setCustomReasons] = useState<{ [id: number]: string }>({});
  const [batchRecoveryType, setBatchRecoveryType] = useState<'installment' | 'full'>('installment');
  const [batchMonthlyCut, setBatchMonthlyCut] = useState<string>('2000');
  const [customMonthlyDeductions, setCustomMonthlyDeductions] = useState<{ [id: number]: string }>({});

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [filterTenure, setFilterTenure] = useState<'all' | 'under6m' | 'regular'>('all');
  const [filterDebt, setFilterDebt] = useState<'all' | 'has_debt' | 'zero_debt'>('all');

  // History Modal State
  const [historyEmpId, setHistoryEmpId] = useState<number | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);

  const loadEligibilityList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/advances/eligibility-list');
      if (res.data?.success) {
        const list = res.data.data || [];
        setEmployees(list);

        // Pre-fill default 50% amounts for each employee
        const defaultAmounts: { [id: number]: string } = {};
        for (const emp of list) {
          defaultAmounts[emp.id] = String(emp.max_advance_allowed || 0);
        }
        setCustomAmounts(defaultAmounts);
      } else {
        setError(res.data?.message || 'Failed to load advance eligibility list');
      }
    } catch (err: any) {
      console.error('Error fetching advance eligibility:', err);
      setError(err.response?.data?.message || 'Failed to connect to advance server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEligibilityList();
      setSelectedIds([]);
      setSearch('');
      setSelectedDept('all');
      setFilterTenure('all');
      setFilterDebt('all');
    }
  }, [isOpen]);

  // Extract unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department_name) set.add(e.department_name);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search code / name
      const query = search.trim().toLowerCase();
      const matchesSearch = !query ||
        emp.name?.toLowerCase().includes(query) ||
        emp.emp_code?.toLowerCase().includes(query);

      // Dept filter
      const matchesDept = selectedDept === 'all' || emp.department_name === selectedDept;

      // Tenure filter
      const matchesTenure = filterTenure === 'all' ||
        (filterTenure === 'under6m' && emp.is_new_joining) ||
        (filterTenure === 'regular' && !emp.is_new_joining);

      // Debt filter
      const matchesDebt = filterDebt === 'all' ||
        (filterDebt === 'has_debt' && Number(emp.current_balance) > 0) ||
        (filterDebt === 'zero_debt' && Number(emp.current_balance) === 0);

      return matchesSearch && matchesDept && matchesTenure && matchesDebt;
    });
  }, [employees, search, selectedDept, filterTenure, filterDebt]);

  // Toggle single employee checkbox
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select all visible filtered employees
  const toggleSelectAll = () => {
    const visibleIds = filteredEmployees.map(e => e.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Update requested amount
  const handleAmountChange = (id: number, val: string) => {
    setCustomAmounts(prev => ({ ...prev, [id]: val }));
  };

  // Update requested reason
  const handleReasonChange = (id: number, val: string) => {
    setCustomReasons(prev => ({ ...prev, [id]: val }));
  };

  // Total amount selected
  const totalSelectedAmount = useMemo(() => {
    return selectedIds.reduce((sum, id) => {
      const amt = Number(customAmounts[id]) || 0;
      return sum + amt;
    }, 0);
  }, [selectedIds, customAmounts]);

  // Count of selected with < 6 months
  const selectedUnder6MCount = useMemo(() => {
    return selectedIds.filter(id => {
      const emp = employees.find(e => e.id === id);
      return Boolean(emp?.is_new_joining);
    }).length;
  }, [selectedIds, employees]);

  // Handle batch submission
  const handleSubmitBatch = async () => {
    if (selectedIds.length === 0) {
      alert('Please checkmark at least one employee for advance request');
      return;
    }

    const payloadItems = selectedIds.map(id => {
      const emp = employees.find(e => e.id === id);
      const amt = Number(customAmounts[id]) || Number(emp?.max_advance_allowed) || 0;
      const deductionTerm = customMonthlyDeductions[id] !== undefined
        ? (parseFloat(customMonthlyDeductions[id]) || 0)
        : (batchRecoveryType === 'installment' ? (parseFloat(batchMonthlyCut) || 0) : 0);
      const cutNote = deductionTerm > 0 ? `₹${deductionTerm}/mo installment` : 'Full deduction in upcoming cycle';

      const reason = customReasons[id] || (
        emp?.is_new_joining 
          ? `Batch request (Probationary < 6M service • 50% cap) • Recovery: ${cutNote}` 
          : `Batch advance request (50% earned wage rule) • Recovery: ${cutNote}`
      );
      return {
        emp_id: id,
        amount: amt,
        monthly_deduction: deductionTerm,
        mode: 'cash',
        reason
      };
    });

    // Validate positive amounts
    const invalid = payloadItems.find(item => item.amount <= 0);
    if (invalid) {
      alert('All selected employees must have a positive advance amount entered (₹ > 0).');
      return;
    }

    const confirmMsg = `Submit advance requests for ${payloadItems.length} employee(s) for a total of ₹${totalSelectedAmount.toLocaleString()} to Admin for approval?${selectedUnder6MCount > 0 ? `\n\n⚠️ Note: ${selectedUnder6MCount} employee(s) have worked less than 6 months.` : ''}`;

    if (!confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      const res = await api.post('/advances/request-batch', { items: payloadItems });
      alert(res.data?.message || `Successfully submitted ${res.data?.count || payloadItems.length} advance requests for Admin approval!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit batch advance requests');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }}>
      <div className="modal-content" style={{ maxWidth: '1150px', width: '96vw', height: '90vh', padding: '0', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
                {isAdmin ? 'Employee Advance Eligibility & Batch Disbursement' : 'Active Employees Advance Request Checklist'}
              </h2>
              <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
                Checkmark active staff to request 50% earned wage advance & submit in batch for Admin approval
              </div>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: 'rgba(255, 255, 255, 0.15)', border: 'none', cursor: 'pointer', color: '#fff', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px', height: '36px', fontSize: '13px' }}
                placeholder="Search Emp ID / Code or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Department Filter */}
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '13px', width: '170px' }}
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Tenure (< 6M) Filter */}
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '13px', width: '180px' }}
              value={filterTenure}
              onChange={(e) => setFilterTenure(e.target.value as any)}
            >
              <option value="all">All Service Tenures</option>
              <option value="under6m">⚠️ Under 6 Months Service</option>
              <option value="regular">Regular (&gt; 6 Months)</option>
            </select>

            {/* Existing Debt Filter */}
            <select
              className="form-input"
              style={{ height: '36px', fontSize: '13px', width: '160px' }}
              value={filterDebt}
              onChange={(e) => setFilterDebt(e.target.value as any)}
            >
              <option value="all">All Debt Status</option>
              <option value="has_debt">Has Existing Debt</option>
              <option value="zero_debt">Zero Outstanding</option>
            </select>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Showing {filteredEmployees.length} of {employees.length} Active Employees
          </div>
        </div>

        {/* Informational Guidance Notice */}
        <div style={{
          padding: '8px 20px',
          background: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#1e40af',
          flexShrink: 0
        }}>
          <div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }}></span>
              <strong style={{ color: '#b45309' }}>Amber = &lt; 6 Months Service</strong>
            </span>
          </div>
        </div>

        {/* Employees Table Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0', background: '#ffffff' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spin" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '12px' }}></div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Calculating live attendance days worked & advance eligibility...</div>
            </div>
          ) : error ? (
            <div style={{ margin: '20px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
              {error}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>No active employees match the search filter</div>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr>
                  <th style={{ width: '44px', textAlign: 'center', padding: '10px 4px' }}>
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.includes(e.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      title="Select all visible employees"
                    />
                  </th>
                  <th style={{ textAlign: 'left', minWidth: '180px' }}>Employee & Dept</th>
                  <th style={{ textAlign: 'center', minWidth: '110px' }}>Service Tenure</th>
                  <th style={{ textAlign: 'center', minWidth: '90px' }}>Days Worked</th>
                  {isAdmin ? (
                    <>
                      <th style={{ textAlign: 'right', minWidth: '100px' }}>Earned Wages</th>
                      <th style={{ textAlign: 'right', minWidth: '110px' }}>50% Advance Cap</th>
                    </>
                  ) : (
                    <th style={{ textAlign: 'center', minWidth: '120px' }}>50% Rule Status</th>
                  )}
                  <th style={{ textAlign: 'left', minWidth: '150px' }}>Advance Debt / Taken</th>
                  <th style={{ textAlign: 'left', minWidth: '140px' }}>Advance Amount (₹)</th>
                  <th style={{ textAlign: 'left', minWidth: '150px' }}>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const isChecked = selectedIds.includes(emp.id);
                  const isUnder6M = Boolean(emp.is_new_joining);
                  const enteredAmt = Number(customAmounts[emp.id]) || 0;
                  const maxCap = Number(emp.max_advance_allowed) || 0;
                  const isOverCap = enteredAmt > maxCap && enteredAmt > 0;
                  const hasDebt = Number(emp.current_balance) > 0;

                  let rowBg = 'transparent';
                  if (isChecked) {
                    rowBg = isUnder6M ? 'rgba(254, 243, 199, 0.7)' : 'rgba(239, 246, 255, 0.7)';
                  } else if (isUnder6M) {
                    rowBg = 'rgba(254, 243, 199, 0.25)';
                  }

                  return (
                    <tr 
                      key={emp.id}
                      style={{ 
                        background: rowBg,
                        borderLeft: isUnder6M ? '4px solid #f59e0b' : '4px solid transparent',
                        transition: 'background 0.1s ease'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(emp.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>

                      {/* Employee Info */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              background: isUnder6M ? '#fde68a' : '#f1f5f9',
                              color: isUnder6M ? '#78350f' : '#1e293b',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: '11px'
                            }}
                          >
                            {emp.emp_code}
                          </span>
                          <strong 
                            style={{ cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px' }}
                            onClick={() => toggleSelect(emp.id)}
                          >
                            {emp.name}
                          </strong>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {emp.department_name} {emp.job_role ? `• ${emp.job_role}` : ''}
                        </div>
                        {emp.pending_request && (
                          <div style={{ marginTop: '2px' }}>
                            <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px', fontWeight: 700 }}>
                              ⏳ Pending Request: ₹{Number(emp.pending_request.amount).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Service Tenure (< 6M highlighted in amber) */}
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        {isUnder6M ? (
                          <div>
                            <span 
                              className="badge" 
                              style={{ 
                                background: '#f59e0b', 
                                color: '#ffffff', 
                                fontSize: '10px', 
                                fontWeight: 800, 
                                padding: '2px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="Joined within last 6 months (Probationary)"
                            >
                              ⚠️ &lt; 6M Service
                            </span>
                            <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px' }}>
                              Joined: {emp.joining_date ? emp.joining_date.slice(0, 10) : 'Recent'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {Math.round((emp.tenure_days || 0) / 365) > 0 
                                ? `${(Number(emp.tenure_days) / 365).toFixed(1)} Yrs` 
                                : `${emp.tenure_months || 6} Mos`}
                            </span>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {emp.joining_date ? emp.joining_date.slice(0, 10) : '—'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Days Worked */}
                      <td style={{ textAlign: 'center', padding: '8px 6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: emp.days_worked > 0 ? '#1e40af' : '#64748b' }}>
                          {emp.days_worked} d
                        </span>
                      </td>

                      {/* Financial Salary / Wages Data (Admin only, hidden for Managers) */}
                      {isAdmin ? (
                        <>
                          <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            ₹{Number(emp.earned_so_far || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb' }}>
                              ₹{Number(emp.max_advance_allowed || 0).toLocaleString()}
                            </span>
                          </td>
                        </>
                      ) : (
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                          <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px' }}>
                            ✓ 50% Standard Cap
                          </span>
                        </td>
                      )}

                      {/* Debt Taken So Far + History Button */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 700, color: hasDebt ? '#dc2626' : '#16a34a', fontSize: '12px' }}>
                              ₹{Number(emp.current_balance || 0).toLocaleString()}
                            </span>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Given: ₹{Number(emp.total_given || 0).toLocaleString()}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}
                            onClick={() => setHistoryEmpId(emp.id)}
                            title="View complete advance transaction ledger"
                          >
                            <History size={12} /> History
                          </button>
                        </div>
                      </td>

                      {/* Editable Advance Amount Input */}
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="form-input"
                            style={{
                              height: '32px',
                              padding: '2px 8px',
                              fontSize: '12px',
                              fontWeight: 700,
                              width: '120px',
                              borderColor: isOverCap ? '#f59e0b' : undefined,
                              background: isChecked ? '#ffffff' : '#f8fafc'
                            }}
                            value={customAmounts[emp.id] !== undefined ? customAmounts[emp.id] : String(emp.max_advance_allowed || '')}
                            onChange={(e) => {
                              handleAmountChange(emp.id, e.target.value);
                              if (!isChecked) toggleSelect(emp.id);
                            }}
                            placeholder="Amount ₹"
                          />
                          {isOverCap && (
                            <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600 }}>
                              ⚠️ Exceeds 50% cap
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Reason / Remarks */}
                      <td style={{ padding: '8px 10px' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{
                            height: '32px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            width: '100%',
                            background: isChecked ? '#ffffff' : '#f8fafc'
                          }}
                          placeholder={isUnder6M ? 'e.g. Emergency (<6M service)' : 'e.g. Festival advance'}
                          value={customReasons[emp.id] || ''}
                          onChange={(e) => {
                            handleReasonChange(emp.id, e.target.value);
                            if (!isChecked) toggleSelect(emp.id);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recovery Term Configuration Strip */}
        <div style={{
          padding: '10px 24px',
          background: '#eff6ff',
          borderTop: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#1e40af' }}>💳 Recovery Terms for Selected:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
              <input 
                type="radio" 
                name="batchRecType" 
                checked={batchRecoveryType === 'installment'} 
                onChange={() => setBatchRecoveryType('installment')} 
              />
              <span>Fixed Monthly Cut:</span>
            </label>
            {batchRecoveryType === 'installment' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 700, color: '#1e40af' }}>₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  style={{ width: '90px', height: '28px', padding: '2px 6px', fontSize: '12px', fontWeight: 700 }}
                  value={batchMonthlyCut}
                  onChange={(e) => setBatchMonthlyCut(e.target.value)}
                  placeholder="2000"
                />
                <span style={{ color: '#475569' }}>/month per employee</span>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginLeft: '6px' }}>
              <input 
                type="radio" 
                name="batchRecType" 
                checked={batchRecoveryType === 'full'} 
                onChange={() => setBatchRecoveryType('full')} 
              />
              <span>Full Deduction in Next Month</span>
            </label>
          </div>
          <div style={{ fontSize: '11px', color: '#1e40af' }}>
            ℹ️ Auto-deducted during monthly salary Calculate / Sync until debt clears
          </div>
        </div>

        {/* Modal Sticky Bottom Action Bar */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.04)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '14px', color: selectedIds.length > 0 ? '#1e40af' : 'var(--text-secondary)' }}>
                {selectedIds.length} employee(s) checkmarked
              </strong>
              {selectedUnder6MCount > 0 && (
                <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px' }}>
                  ⚠️ {selectedUnder6MCount} &lt; 6M Service
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total Advance Requested: <strong style={{ color: '#d97706', fontSize: '15px' }}>₹{totalSelectedAmount.toLocaleString()}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                background: selectedIds.length > 0 ? '#16a34a' : undefined,
                borderColor: selectedIds.length > 0 ? '#16a34a' : undefined,
                padding: '8px 20px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: selectedIds.length > 0 ? '0 2px 6px rgba(22, 163, 74, 0.3)' : undefined
              }}
              onClick={handleSubmitBatch}
              disabled={submitting || selectedIds.length === 0}
            >
              <Send size={16} />
              {submitting 
                ? 'Submitting Requests...' 
                : `Submit ${selectedIds.length} Advance Request(s) to Admin (₹${totalSelectedAmount.toLocaleString()})`
              }
            </button>
          </div>
        </div>

      </div>

      {/* Individual Employee Advance Transaction Ledger History Modal */}
      <AdvanceHistoryModal
        empId={historyEmpId}
        isOpen={historyEmpId !== null}
        onClose={() => setHistoryEmpId(null)}
      />
    </div>
  );
};

export default BatchAdvanceModal;

