import React, { useState, useEffect } from 'react';
import { X, DollarSign, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import api from '../api/client';

interface AdvanceHistoryModalProps {
  empId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdvanceHistoryModal: React.FC<AdvanceHistoryModalProps> = ({
  empId,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && empId) {
      setLoading(true);
      setError(null);
      api.get(`/advances/employee/${empId}/history`)
        .then(res => {
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setError(res.data?.message || 'Failed to load advance history');
          }
        })
        .catch(err => {
          console.error('Error fetching employee advance history:', err);
          setError(err.response?.data?.message || 'Error connecting to server');
        })
        .finally(() => setLoading(false));
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, empId]);

  if (!isOpen) return null;

  const emp = data?.employee;
  const transactions = data?.transactions || [];

  return (
    <div className="modal-overlay" style={{ zIndex: 1250 }}>
      <div className="modal-content" style={{ maxWidth: '680px', padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#2563eb', color: '#fff', padding: '8px', borderRadius: '10px' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {emp?.name ? `${emp.name} (${emp.emp_code})` : 'Employee Advance History'}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {emp?.department_name || 'Staff'} • Joined: {emp?.joining_date ? emp.joining_date.slice(0, 10) : '—'}
                {emp?.is_new_joining ? (
                  <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 800, marginLeft: '6px', padding: '1px 5px' }}>
                    ⚠️ &lt; 6M Service
                  </span>
                ) : null}
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

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div className="spin" style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', marginBottom: '10px' }}></div>
            <div>Loading employee advance transaction ledger...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
            {error}
          </div>
        ) : (
          <div>
            {/* Quick Summary KPI Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef08a', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600, textTransform: 'uppercase' }}>Total Given</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                  ₹{Number(data?.total_given || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Total Deducted</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  ₹{Number(data?.total_deducted || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: Number(data?.current_balance || 0) > 0 ? '#fef2f2' : '#f8fafc', border: Number(data?.current_balance || 0) > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: '10px' }}>
                <div style={{ fontSize: '11px', color: Number(data?.current_balance || 0) > 0 ? '#991b1b' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Current Outstanding Debt</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: Number(data?.current_balance || 0) > 0 ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                  ₹{Number(data?.current_balance || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Transactions History Table */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: 'var(--text-secondary)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Type</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Amount</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px' }}>Mode</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Remarks / Purpose</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No past advance transactions recorded for this employee.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx: any) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{tx.date ? tx.date.slice(0, 10) : '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {tx.type === 'given' ? (
                            <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <ArrowUpRight size={11} /> Advance Given
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <ArrowDownLeft size={11} /> Deducted
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: tx.type === 'given' ? '#d97706' : '#16a34a' }}>
                          ₹{Number(tx.amount).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>{tx.mode || 'cash'}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                          <div>{tx.remarks || '—'}</div>
                          {tx.source_flag && (
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({tx.source_flag})</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                          {tx.created_by_name || 'System'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvanceHistoryModal;

