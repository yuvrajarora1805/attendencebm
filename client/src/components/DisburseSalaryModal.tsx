import React, { useState, useEffect } from 'react';
import { Banknote, CheckCircle, Clock, Search, X, Download } from 'lucide-react';
import api from '../api/client';

interface DisburseSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSearchTerm?: string;
}

export const DisburseSalaryModal: React.FC<DisburseSalaryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultSearchTerm
}) => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | string>('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState(defaultSearchTerm || '');

  const loadPeriods = async () => {
    try {
      const res = await api.get('/salary/periods');
      const list = res.data?.data || [];
      setPeriods(list);
      if (list.length > 0) {
        setSelectedPeriodId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEntries = async (periodId: number | string) => {
    if (!periodId) return;
    try {
      setLoading(true);
      const res = await api.get(`/salary/periods/${periodId}/entries?status=active`);
      setEntries(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (defaultSearchTerm) {
        setSearchTerm(defaultSearchTerm);
      }
      loadPeriods();
    }
  }, [isOpen, defaultSearchTerm]);

  useEffect(() => {
    if (selectedPeriodId) {
      loadEntries(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  if (!isOpen) return null;

  const handleGenerateEntries = async () => {
    if (!selectedPeriodId) return;
    try {
      setGenerating(true);
      await api.post(`/salary/periods/${selectedPeriodId}/generate`);
      await loadEntries(selectedPeriodId);
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to auto-generate salary entries');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (entry: any) => {
    if (!confirm(`Mark salary of ₹${Math.round(entry.gross_amount).toLocaleString()} as PAID for ${entry.emp_name}?`)) {
      return;
    }
    try {
      setProcessingId(entry.id);
      await api.put(`/salary/entries/${entry.id}`, {
        ...entry,
        paid: 1,
        paid_at: new Date().toISOString()
      });
      loadEntries(selectedPeriodId);
      onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredEntries = entries.filter(e => 
    (e.emp_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.emp_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unpaidCount = entries.filter(e => !e.paid).length;
  const totalUnpaidAmount = entries.filter(e => !e.paid).reduce((sum, e) => sum + Number(e.gross_amount || 0), 0);

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#10b981', color: '#fff', padding: '6px', borderRadius: '8px' }}>
              <Banknote size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Disburse Monthly Salary</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Review net payroll amounts, verify payments, and mark as settled
              </div>
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

        {/* Period Selector & Summary Strip */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--surface-sunken, #f8fafc)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Payroll Cycle:</span>
            <select
              className="form-input"
              style={{ height: '34px', fontSize: '13px' }}
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {new Date(0, p.month - 1).toLocaleString('en', { month: 'long' })} {p.year} {p.is_locked ? '(Locked)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
            <div>Pending: <strong>{unpaidCount} employees</strong></div>
            <div>Pending Amount: <strong style={{ color: '#dc2626' }}>₹{Math.round(totalUnpaidAmount).toLocaleString()}</strong></div>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '12px', position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
        </div>

        {/* Table of Entries */}
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading entries...</div>
          ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Present</th>
                  <th>Basic</th>
                  <th>Advance Deduct</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.emp_name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entry.emp_code} &bull; {entry.job_role || 'Staff'}</div>
                    </td>
                    <td>{entry.present_days}d</td>
                    <td>₹{Number(entry.basic_salary).toLocaleString()}</td>
                    <td>{Number(entry.advance_deduction || 0) > 0 ? `₹${Number(entry.advance_deduction).toLocaleString()}` : '—'}</td>
                    <td>
                      <strong style={{ color: '#059669', fontSize: '14px' }}>
                        ₹{Math.round(entry.gross_amount).toLocaleString()}
                      </strong>
                    </td>
                    <td>
                      {entry.paid ? (
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>Paid</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '11px' }}>Unpaid</span>
                      )}
                    </td>
                    <td>
                      {entry.paid ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Settled</span>
                      ) : (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}
                          disabled={processingId === entry.id}
                          onClick={() => handleMarkPaid(entry)}
                        >
                          {processingId === entry.id ? 'Saving...' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      {entries.length === 0 ? (
                        <div>
                          <div style={{ marginBottom: '8px' }}>No salary entries found for this payroll cycle.</div>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: '12px', padding: '6px 14px' }}
                            onClick={handleGenerateEntries}
                            disabled={generating}
                          >
                            {generating ? 'Calculating Payroll...' : '⚡ Generate Salary Entries From Attendance'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ marginBottom: '8px' }}>No matching employee found for "{searchTerm}".</div>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => setSearchTerm('')}
                          >
                            Clear Search Filter
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
          <a
            href="/salary"
            style={{ fontSize: '13px', color: '#059669', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Go to Full Salary Sheet &rarr;
          </a>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisburseSalaryModal;
