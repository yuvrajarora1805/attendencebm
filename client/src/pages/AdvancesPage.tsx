import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, ArrowUpRight, ArrowDownLeft, Trash2, Calendar, Search,
  CheckCircle2, XCircle, Clock, ShieldCheck, AlertTriangle, X
} from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import DataTable, { Column } from '../components/DataTable';
import GiveAdvanceModal from '../components/GiveAdvanceModal';
import BatchAdvanceModal from '../components/BatchAdvanceModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AdvancesPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager') && !isAdmin;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Manager Advance Requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'requests'>(isManager ? 'requests' : 'transactions');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approvingItem, setApprovingItem] = useState<any | null>(null);
  const [approvalAmount, setApprovalAmount] = useState<string>('');
  const [approvalDeduction, setApprovalDeduction] = useState<string>('2000');
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [rejectDialogItem, setRejectDialogItem] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState(false);

  // Bulk Approval state
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDeduction, setBulkDeduction] = useState<string>('2000');
  const [bulkNotes, setBulkNotes] = useState<string>('Bulk approved by Admin');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterFlag, setFilterFlag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      let url = '/advances?';
      if (filterType !== 'all') url += `type=${filterType}&`;
      if (filterFlag !== 'all') url += `source_flag=${filterFlag}&`;
      if (filterStatus !== 'all') url += `status=${filterStatus}&`;
      const res = await api.get(url);
      setTransactions(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load advances', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get('/advances/requests');
      setRequests(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load advance requests', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadData();
    loadRequests();
  }, [filterType, filterFlag, filterStatus]);

  const handleDelete = async (reason: string) => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await api.delete(`/advances/${deleteId}`, { data: { reason } });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingItem) return;
    try {
      setApprovalSaving(true);
      const res = await api.post(`/advances/requests/${approvingItem.id}/approve`, {
        amount: Number(approvalAmount),
        monthly_deduction: parseFloat(approvalDeduction) || 0,
        admin_notes: approvalNotes
      });
      alert(res.data.message || 'Advance approved and disbursed successfully!');
      setApprovingItem(null);
      await loadRequests();
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve advance request');
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleRejectRequest = async (reason: string) => {
    if (!rejectDialogItem) return;
    try {
      setRejecting(true);
      const res = await api.post(`/advances/requests/${rejectDialogItem.id}/reject`, { reason });
      alert(res.data.message || 'Advance request rejected');
      setRejectDialogItem(null);
      await loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject advance request');
    } finally {
      setRejecting(false);
    }
  };

  const handleBulkApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRequestIds.length === 0) return;
    try {
      setBulkSaving(true);
      const res = await api.post('/advances/requests/bulk-approve', {
        request_ids: selectedRequestIds,
        default_monthly_deduction: parseFloat(bulkDeduction) || 0,
        admin_notes: bulkNotes
      });
      alert(res.data.message || 'Bulk advance approval successful!');
      setBulkModalOpen(false);
      setSelectedRequestIds([]);
      await loadRequests();
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to bulk approve advance requests');
    } finally {
      setBulkSaving(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  const filteredRequests = requests.filter(r => {
    if (requestStatusFilter === 'all') return true;
    return r.status === requestStatusFilter;
  });

  const toggleSelectAll = () => {
    if (selectedRequestIds.length === pendingRequests.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(pendingRequests.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedRequestIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const totalSelectedAmount = requests
    .filter(r => selectedRequestIds.includes(r.id))
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // Metrics
  const totalGiven = transactions
    .filter(t => t.type === 'given')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalDeducted = transactions
    .filter(t => t.type === 'deduction')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const netOutstanding = totalGiven - totalDeducted;

  const columns: Column<any>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      render: (row) => row.date ? row.date.slice(0, 10) : '—'
    },
    {
      key: 'emp_code',
      header: 'Code',
      width: '90px',
      render: (row) => (
        <span
          style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}
          onClick={() => navigate(`/employees/${row.emp_id}`)}
          title="View Employee Profile"
        >
          {row.emp_code}
        </span>
      )
    },
    {
      key: 'emp_name',
      header: 'Employee',
      render: (row) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{ cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate(`/employees/${row.emp_id}`)}
            >
              {row.emp_name}
            </span>
            {Boolean(row.is_new_joining) && (
              <span 
                className="badge" 
                style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', padding: '1px 5px', fontWeight: 800 }} 
                title="Employee worked less than 6 months (Probationary)"
              >
                ⚠️ &lt; 6M
              </span>
            )}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Status: <span style={{ color: row.emp_status === 'active' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{row.emp_status || 'active'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      width: '120px',
      render: (row) => row.type === 'given' ? (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowUpRight size={12} /> Advance Given
        </span>
      ) : (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ArrowDownLeft size={12} /> Deducted
        </span>
      )
    },
    {
      key: 'source_flag',
      header: 'Source Origin',
      width: '130px',
      render: (row) => {
        const flag = row.source_flag || 'SALARYPAYMENT';
        if (flag === 'SALARY') return <span className="badge badge-info" style={{ fontSize: '10px' }}>Payroll Recovery</span>;
        if (flag === 'AccMaster') return <span className="badge badge-warning" style={{ fontSize: '10px' }}>Opening Bal</span>;
        return <span className="badge badge-success" style={{ fontSize: '10px' }}>Cash Payout</span>;
      }
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <strong style={{ color: row.type === 'given' ? '#d97706' : '#15803d', fontSize: '14px' }}>
          ₹{Number(row.amount).toLocaleString()}
        </strong>
      )
    },
    {
      key: 'mode',
      header: 'Mode',
      width: '100px',
      render: (row) => <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>{row.mode || 'cash'}</span>
    },
    {
      key: 'remarks',
      header: 'Remarks / Purpose',
      render: (row) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{row.remarks || '—'}</span>
    },
    {
      key: 'created_by_name',
      header: 'Handled By',
      width: '120px',
      render: (row) => <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{row.created_by_name || 'System'}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '90px',
      render: (row) => hasRole('admin') ? (
        <button
          className="btn btn-danger"
          style={{ padding: '4px 8px' }}
          onClick={() => setDeleteId(row.id)}
          title="Delete Transaction"
        >
          <Trash2 size={13} />
        </button>
      ) : null
    }
  ];

  return (
    <div>
      <Topbar
        title="Advance & Loan Ledger"
        subtitle="Track disbursements, monthly salary recoveries, and current outstanding balances"
        actions={
          hasRole('admin', 'hr', 'payroll', 'manager') ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                }}
                onClick={() => setBatchModalOpen(true)}
                title="Active Employees Advance Checklist (50% Earned Wages)"
              >
                ⚡ Batch Advance Checklist
              </button>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setModalOpen(true)}
              >
                <Plus size={16} /> {isAdmin ? 'Single Advance' : 'Single Request'}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="page-container">
        {/* Pending Requests Review Banner for Admin */}
        {pendingRequests.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-warning" style={{ fontSize: '12px', padding: '4px 10px', fontWeight: 700 }}>
                  ⚠️ {pendingRequests.length} Pending Approval
                </span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#92400e' }}>
                  Manager Advance Requests Awaiting Admin Action
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isAdmin && pendingRequests.length > 0 && (
                  <button
                    className="btn btn-sm"
                    style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, padding: '5px 12px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      setSelectedRequestIds(pendingRequests.map(r => r.id));
                      setBulkModalOpen(true);
                    }}
                  >
                    ⚡ Bulk Approve All ({pendingRequests.length})
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '12px', background: '#fff', borderColor: '#d97706', color: '#b45309', fontWeight: 600 }}
                  onClick={() => setActiveTab('requests')}
                >
                  View All Requests ({requests.length})
                </button>
              </div>
            </div>

            {/* Selection Action Bar */}
            {isAdmin && selectedRequestIds.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                marginBottom: '10px',
                fontSize: '13px'
              }}>
                <span style={{ fontWeight: 600, color: '#1e40af' }}>
                  ✓ {selectedRequestIds.length} request(s) selected (Total: ₹{totalSelectedAmount.toLocaleString()})
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setSelectedRequestIds([])}
                  >
                    Clear Selection
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={() => setBulkModalOpen(true)}
                  >
                    ⚡ Bulk Approve Selected ({selectedRequestIds.length})
                  </button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '10px', border: '1px solid #fef08a' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {isAdmin && (
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.length === pendingRequests.length && pendingRequests.length > 0}
                          onChange={toggleSelectAll}
                          title="Select / Deselect all"
                        />
                      </th>
                    )}
                    <th>Date</th>
                    <th>Employee & Joining</th>
                    <th>Attendance & Leaves</th>
                    <th>Requested By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Mode</th>
                    <th>Reason / Purpose</th>
                    <th style={{ textAlign: 'center' }}>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr 
                      key={req.id}
                      style={{
                        background: Boolean(req.is_new_joining) ? '#fffbeb' : undefined,
                        borderLeft: Boolean(req.is_new_joining) ? '4px solid #f59e0b' : undefined
                      }}
                    >
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedRequestIds.includes(req.id)}
                            onChange={() => toggleSelectOne(req.id)}
                          />
                        </td>
                      )}
                      <td style={{ fontSize: '12px' }}>{req.created_at ? req.created_at.slice(0, 10) : 'Today'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong 
                            style={{ cursor: 'pointer', color: 'var(--primary-700)' }}
                            onClick={() => navigate(`/employees/${req.emp_id}`)}
                          >
                            {req.emp_name}
                          </strong>
                          {Boolean(req.is_new_joining) && (
                            <span 
                              className="badge" 
                              style={{ 
                                background: '#f59e0b', 
                                color: '#ffffff', 
                                fontSize: '10px', 
                                padding: '2px 7px', 
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }} 
                              title="Employee worked less than 6 months (Probationary / High Risk)"
                            >
                              ⚠️ &lt; 6M Service
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.emp_code} • {req.department_name || 'Staff'}</div>
                        <div style={{ fontSize: '11px', color: Boolean(req.is_new_joining) ? '#b45309' : 'var(--text-secondary)', marginTop: '2px' }}>
                          📅 Joined: <strong>{req.joining_date ? req.joining_date.slice(0, 10) : '—'}</strong>
                          {req.tenure_days ? ` (${Math.max(1, Math.round(Number(req.tenure_days) / 30))} mos service)` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                          <div>
                            Last Mo Leaves: <strong style={{ color: Number(req.last_month_leaves || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                              {req.last_month_leaves || 0}d
                            </strong>
                          </div>
                          <div>
                            This Mo Leaves: <strong style={{ color: Number(req.cur_month_leaves || 0) > 0 ? '#d97706' : '#16a34a' }}>
                              {req.cur_month_leaves || 0}d
                            </strong>
                          </div>
                          <div>
                            Debt: <strong style={{ color: Number(req.current_advance_balance || 0) > 0 ? '#b91c1c' : 'inherit' }}>
                              ₹{Number(req.current_advance_balance || 0).toLocaleString()}
                            </strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--primary-700)', fontSize: '12px' }}>
                          {req.requested_by_name || req.requested_by_username || 'Manager'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#d97706', fontSize: '14px' }}>
                        ₹{Number(req.amount).toLocaleString()}
                      </td>
                      <td><span className="badge badge-info">{req.mode?.toUpperCase()}</span></td>
                      <td style={{ maxWidth: '200px', fontSize: '12px' }}>{req.reason}</td>
                      <td style={{ textAlign: 'center' }}>
                        {isAdmin ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}
                              onClick={() => {
                                setApprovingItem(req);
                                setApprovalAmount(String(req.amount));
                                setApprovalNotes('');
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}
                              onClick={() => setRejectDialogItem(req)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="badge badge-warning">Pending Review</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button 
            className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontWeight: 700, fontSize: '13px' }}
            onClick={() => setActiveTab('requests')}
          >
            📝 Advance Requests & Approvals ({requests.length}{pendingRequests.length > 0 ? ` • ${pendingRequests.length} Pending` : ''})
          </button>
          {!isManager && (
            <button 
              className={`btn ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600, fontSize: '13px' }}
              onClick={() => setActiveTab('transactions')}
            >
              📊 Disbursed Ledger ({transactions.length})
            </button>
          )}
        </div>

        {/* Manager KPI Strip: Request & Approval Metrics (Salary & Disbursed Totals Hidden for Manager) */}
        {isManager ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <div 
              className="card" 
              style={{ 
                padding: '16px', 
                border: '1px solid var(--border-color)', 
                cursor: 'pointer', 
                background: requestStatusFilter === 'all' ? '#eff6ff' : undefined,
                borderColor: requestStatusFilter === 'all' ? '#3b82f6' : undefined
              }}
              onClick={() => { setActiveTab('requests'); setRequestStatusFilter('all'); }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Advance Requests
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e40af', marginTop: '4px' }}>
                {requests.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>All submitted requests</div>
            </div>

            <div 
              className="card" 
              style={{ 
                padding: '16px', 
                border: '1px solid #fde68a', 
                cursor: 'pointer', 
                background: requestStatusFilter === 'pending' ? '#fffbeb' : undefined,
                borderColor: requestStatusFilter === 'pending' ? '#f59e0b' : '#fde68a'
              }}
              onClick={() => { setActiveTab('requests'); setRequestStatusFilter('pending'); }}
            >
              <div style={{ fontSize: '11px', color: '#b45309', textTransform: 'uppercase', fontWeight: 700 }}>
                ⏳ Pending Admin Approval
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
                {pendingRequests.length}
              </div>
              <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>Awaiting Admin review</div>
            </div>

            <div 
              className="card" 
              style={{ 
                padding: '16px', 
                border: '1px solid #bbf7d0', 
                cursor: 'pointer', 
                background: requestStatusFilter === 'approved' ? '#f0fdf4' : undefined,
                borderColor: requestStatusFilter === 'approved' ? '#16a34a' : '#bbf7d0'
              }}
              onClick={() => { setActiveTab('requests'); setRequestStatusFilter('approved'); }}
            >
              <div style={{ fontSize: '11px', color: '#15803d', textTransform: 'uppercase', fontWeight: 700 }}>
                ✅ Approved Advances
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
                {approvedRequests.length}
              </div>
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>Authorized & Disbursed</div>
            </div>

            <div 
              className="card" 
              style={{ 
                padding: '16px', 
                border: '1px solid #fecaca', 
                cursor: 'pointer', 
                background: requestStatusFilter === 'rejected' ? '#fef2f2' : undefined,
                borderColor: requestStatusFilter === 'rejected' ? '#dc2626' : '#fecaca'
              }}
              onClick={() => { setActiveTab('requests'); setRequestStatusFilter('rejected'); }}
            >
              <div style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 700 }}>
                ❌ Rejected Requests
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
                {rejectedRequests.length}
              </div>
              <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>Declined by Admin</div>
            </div>
          </div>
        ) : (
          /* Admin Financial Ledger KPI Strip */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}>
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Advances Disbursed
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
                ₹{totalGiven.toLocaleString()}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Deducted / Recovered
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d', marginTop: '4px' }}>
                ₹{totalDeducted.toLocaleString()}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Net Outstanding Ledger Balance
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: netOutstanding > 0 ? '#2563eb' : '#64748b', marginTop: '4px' }}>
                ₹{netOutstanding.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' ? (
          <DataTable
            columns={columns}
            data={transactions}
            loading={loading}
            searchPlaceholder="Search by employee, code, remarks..."
            searchKey={(row) => `${row.emp_name} ${row.emp_code} ${row.remarks || ''} ${row.mode || ''}`}
            extraControls={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
                <select
                  className="form-input"
                  style={{ height: '36px', fontSize: '13px', width: '130px', padding: '4px 10px' }}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive</option>
                </select>

                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '6px' }}>Type:</span>
                <select
                  className="form-input"
                  style={{ height: '36px', fontSize: '13px', width: '150px', padding: '4px 10px' }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="given">Advances Given</option>
                  <option value="deduction">Deductions</option>
                </select>

                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '6px' }}>Source:</span>
                <select
                  className="form-input"
                  style={{ height: '36px', fontSize: '13px', width: '170px', padding: '4px 10px' }}
                  value={filterFlag}
                  onChange={(e) => setFilterFlag(e.target.value)}
                >
                  <option value="all">All Origins</option>
                  <option value="SALARYPAYMENT">Cash Payouts</option>
                  <option value="SALARY">Payroll Recoveries</option>
                  <option value="AccMaster">Opening Balances</option>
                </select>
              </div>
            }
          />
        ) : (
          /* Advance Requests Tab */
          <div>
            {/* Request Status Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn btn-sm ${requestStatusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12px', fontWeight: 600 }}
                  onClick={() => setRequestStatusFilter('all')}
                >
                  All Requests ({requests.length})
                </button>
                <button
                  className={`btn btn-sm ${requestStatusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    background: requestStatusFilter === 'pending' ? '#d97706' : undefined, 
                    color: requestStatusFilter === 'pending' ? '#fff' : '#b45309',
                    borderColor: requestStatusFilter === 'pending' ? '#d97706' : '#fde68a'
                  }}
                  onClick={() => setRequestStatusFilter('pending')}
                >
                  ⏳ Pending ({pendingRequests.length})
                </button>
                <button
                  className={`btn btn-sm ${requestStatusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    background: requestStatusFilter === 'approved' ? '#16a34a' : undefined, 
                    color: requestStatusFilter === 'approved' ? '#fff' : '#15803d',
                    borderColor: requestStatusFilter === 'approved' ? '#16a34a' : '#bbf7d0'
                  }}
                  onClick={() => setRequestStatusFilter('approved')}
                >
                  ✅ Approved ({approvedRequests.length})
                </button>
                <button
                  className={`btn btn-sm ${requestStatusFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    background: requestStatusFilter === 'rejected' ? '#dc2626' : undefined, 
                    color: requestStatusFilter === 'rejected' ? '#fff' : '#991b1b',
                    borderColor: requestStatusFilter === 'rejected' ? '#dc2626' : '#fecaca'
                  }}
                  onClick={() => setRequestStatusFilter('rejected')}
                >
                  ❌ Rejected ({rejectedRequests.length})
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Showing <strong>{filteredRequests.length}</strong> of {requests.length} requests
              </div>
            </div>

            <div className="card" style={{ padding: '0', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Request Date</th>
                    <th>Employee</th>
                    <th>Requested By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Mode</th>
                    <th>Reason / Purpose</th>
                    <th style={{ textAlign: 'center' }}>Admin Decision Status</th>
                    <th>Admin Feedback & Remarks</th>
                    {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '36px' }}>
                        <span className="spinner"></span> Loading requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No {requestStatusFilter !== 'all' ? requestStatusFilter : ''} advance requests found. Shift managers can click "Batch Advance Checklist" above to submit.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';
                      const isPending = req.status === 'pending';
                      
                      let rowBackground = undefined;
                      let rowBorderLeft = undefined;

                      if (isApproved) {
                        rowBackground = 'rgba(22, 163, 74, 0.04)';
                        rowBorderLeft = '4px solid #16a34a';
                      } else if (isRejected) {
                        rowBackground = 'rgba(220, 38, 38, 0.04)';
                        rowBorderLeft = '4px solid #dc2626';
                      } else if (isPending) {
                        rowBackground = 'rgba(245, 158, 11, 0.04)';
                        rowBorderLeft = '4px solid #f59e0b';
                      }

                      return (
                        <tr 
                          key={req.id}
                          style={{
                            background: rowBackground,
                            borderLeft: rowBorderLeft
                          }}
                        >
                          <td>{req.created_at ? req.created_at.slice(0, 10) : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong 
                                style={{ cursor: 'pointer', color: 'var(--primary-700)' }}
                                onClick={() => navigate(`/employees/${req.emp_id}`)}
                              >
                                {req.emp_name}
                              </strong>
                              {Boolean(req.is_new_joining) && (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    background: '#f59e0b', 
                                    color: '#ffffff', 
                                    fontSize: '9px', 
                                    padding: '1px 5px', 
                                    fontWeight: 800 
                                  }} 
                                  title="Employee worked less than 6 months (Probationary)"
                                >
                                  ⚠️ &lt; 6M
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.emp_code} • {req.department_name || 'Staff'}</div>
                            {req.joining_date && (
                              <div style={{ fontSize: '10px', color: Boolean(req.is_new_joining) ? '#b45309' : 'var(--text-muted)' }}>
                                Joined: {req.joining_date.slice(0, 10)}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{req.requested_by_name || req.requested_by_username || 'Manager'}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-warning)', fontSize: '14px' }}>
                            ₹{Number(req.amount).toLocaleString()}
                          </td>
                          <td><span className="badge badge-info">{req.mode?.toUpperCase() || 'CASH'}</span></td>
                          <td style={{ maxWidth: '220px' }}>
                            <div style={{ fontSize: '12px' }}>{req.reason}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isApproved ? (
                              <span className="badge badge-success" style={{ fontWeight: 800, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ✓ Approved & Disbursed
                              </span>
                            ) : isRejected ? (
                              <span className="badge badge-danger" style={{ fontWeight: 800, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ✕ Rejected by Admin
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ fontWeight: 800, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ⏳ Pending Admin Review
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {isApproved ? (
                              <div>
                                <div style={{ color: '#16a34a', fontWeight: 700 }}>
                                  ✓ Authorized {req.reviewed_by_name ? `by ${req.reviewed_by_name}` : ''}
                                </div>
                                {req.admin_notes && (
                                  <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                                    <strong>Note:</strong> {req.admin_notes}
                                  </div>
                                )}
                                {req.reviewed_at && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Approved: {req.reviewed_at.slice(0, 10)}
                                  </div>
                                )}
                              </div>
                            ) : isRejected ? (
                              <div>
                                <div style={{ color: '#dc2626', fontWeight: 700 }}>
                                  ✕ Declined {req.reviewed_by_name ? `by ${req.reviewed_by_name}` : ''}
                                </div>
                                {req.admin_notes && (
                                  <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                                    <strong>Reason:</strong> {req.admin_notes}
                                  </div>
                                )}
                                {req.reviewed_at && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Rejected: {req.reviewed_at.slice(0, 10)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                                Awaiting Administrator action
                              </div>
                            )}
                          </td>
                          {isAdmin && (
                            <td style={{ textAlign: 'center' }}>
                              {isPending ? (
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}
                                    onClick={() => {
                                      setApprovingItem(req);
                                      setApprovalAmount(String(req.amount));
                                      setApprovalNotes('');
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}
                                    onClick={() => setRejectDialogItem(req)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Admin Approval Dialog */}
      {approvingItem && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#16a34a', color: '#fff', padding: '8px', borderRadius: '10px' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Approve Advance Request</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Authorize payout & configure monthly payroll recovery</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setApprovingItem(null)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApproveRequest}>
              {/* Tenure Warning Banner for < 6 Months Service */}
              {Boolean(approvingItem.is_new_joining) && (
                <div style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '10px',
                  color: '#92400e',
                  fontSize: '12px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)'
                }}>
                  <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '12px' }}>
                      ⚠️ TENURE WARNING: EMPLOYEE WORKED LESS THAN 6 MONTHS
                    </div>
                    <div style={{ fontSize: '11px', marginTop: '2px', color: '#78350f' }}>
                      Joined on <strong>{approvingItem.joining_date ? approvingItem.joining_date.slice(0, 10) : 'recent date'}</strong> ({Math.max(1, Math.round((approvingItem.tenure_days || 0) / 30))} month(s) service).
                      Caution recommended before approving advance for probationary employees.
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Employee Attendance, Joining & Debt Breakdown Card */}
              <div style={{
                padding: '14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {approvingItem.emp_name} <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>({approvingItem.emp_code})</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {approvingItem.department_name || 'Staff'} • Requested by <strong>{approvingItem.requested_by_name || approvingItem.requested_by_username || 'Shift Manager'}</strong>
                    </div>
                  </div>
                  {Boolean(approvingItem.is_new_joining) && (
                    <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 8px', fontWeight: 700 }}>
                      🌱 New Joiner (&lt; 6M)
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  background: '#ffffff',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>📅 Date of Joining</span>
                    <strong style={{ fontSize: '12px' }}>
                      {approvingItem.joining_date ? approvingItem.joining_date.slice(0, 10) : '—'}
                      {approvingItem.tenure_days ? ` (${(Number(approvingItem.tenure_days) / 365).toFixed(1)} yrs)` : ''}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>💳 Existing Debt</span>
                    <strong style={{ fontSize: '12px', color: Number(approvingItem.current_advance_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      ₹{Number(approvingItem.current_advance_balance || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>🍂 Last Month Leaves</span>
                    <strong style={{ fontSize: '12px', color: Number(approvingItem.last_month_leaves || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      {approvingItem.last_month_leaves || 0} days
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>⏱️ This Month Leaves</span>
                    <strong style={{ fontSize: '12px', color: Number(approvingItem.cur_month_leaves || 0) > 0 ? '#d97706' : '#16a34a' }}>
                      {approvingItem.cur_month_leaves || 0} days
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Reason: <em>"{approvingItem.reason}"</em> ({approvingItem.mode?.toUpperCase()})
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Approved Payout Amount (₹) *</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ fontWeight: 700, fontSize: '15px' }}
                  value={approvalAmount}
                  onChange={(e) => setApprovalAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Monthly Salary Recovery Installment (₹/month)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  value={approvalDeduction}
                  onChange={(e) => setApprovalDeduction(e.target.value)}
                  placeholder="2000"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  Amount to automatically deduct from monthly salary until the debt is recovered.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Admin Approval Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Approved for medical emergency"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setApprovingItem(null)} disabled={approvalSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} disabled={approvalSaving}>
                  {approvalSaving ? 'Disbursing...' : 'Confirm & Disburse Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Bulk Approval Dialog */}
      {bulkModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '560px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#16a34a', color: '#fff', padding: '8px', borderRadius: '10px' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Bulk Approve Advance Requests ({selectedRequestIds.length})
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Disburse multiple staff advances simultaneously with structured recovery
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setBulkModalOpen(false)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkApprove}>
              {requests.filter(r => selectedRequestIds.includes(r.id) && Boolean(r.is_new_joining)).length > 0 && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fffbeb',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '8px',
                  color: '#92400e',
                  fontSize: '11px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Tenure Warning:</strong> {requests.filter(r => selectedRequestIds.includes(r.id) && Boolean(r.is_new_joining)).length} selected employee(s) have worked less than 6 months (highlighted in amber).
                  </span>
                </div>
              )}

              <div style={{
                maxHeight: '190px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                marginBottom: '16px',
                padding: '8px',
                background: '#fafafa'
              }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '4px' }}>Employee</th>
                      <th style={{ textAlign: 'center', padding: '4px' }}>Joining Date</th>
                      <th style={{ textAlign: 'center', padding: '4px' }}>Leaves (Last / This)</th>
                      <th style={{ textAlign: 'right', padding: '4px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests
                      .filter(r => selectedRequestIds.includes(r.id))
                      .map(r => (
                        <tr 
                          key={r.id} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9',
                            background: Boolean(r.is_new_joining) ? '#fffbeb' : undefined 
                          }}
                        >
                          <td style={{ padding: '6px 4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong>{r.emp_name}</strong>
                              {Boolean(r.is_new_joining) && (
                                <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', padding: '1px 5px', fontWeight: 800 }}>
                                  ⚠️ &lt; 6M
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.emp_code}</div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            {r.joining_date ? r.joining_date.slice(0, 10) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px' }}>
                            <span style={{ color: Number(r.last_month_leaves || 0) > 0 ? '#dc2626' : 'inherit' }}>{r.last_month_leaves || 0}d</span> / <span style={{ color: Number(r.cur_month_leaves || 0) > 0 ? '#d97706' : 'inherit' }}>{r.cur_month_leaves || 0}d</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '4px', fontWeight: 700, color: '#d97706' }}>
                            ₹{Number(r.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Total Payout across {selectedRequestIds.length} employees:</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)' }}>₹{totalSelectedAmount.toLocaleString()}</span>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Monthly Salary Deduction Installment (₹/month per employee)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  value={bulkDeduction}
                  onChange={(e) => setBulkDeduction(e.target.value)}
                  placeholder="2000"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  Target monthly installment to deduct from upcoming salary sheets to recover the debt safely.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Batch Approval Remarks (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bulk approved by Admin"
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBulkModalOpen(false)} disabled={bulkSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 700 }} disabled={bulkSaving}>
                  {bulkSaving ? 'Approving Batch...' : `Confirm Bulk Approve & Disburse (₹${totalSelectedAmount.toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Rejection Dialog */}
      <ConfirmDialog
        isOpen={rejectDialogItem !== null}
        title="Reject Advance Request"
        message={`Are you sure you want to reject the advance request of ₹${Number(rejectDialogItem?.amount || 0).toLocaleString()} for ${rejectDialogItem?.emp_name}?`}
        confirmText="Reject Request"
        requireReason={true}
        loading={rejecting}
        onConfirm={handleRejectRequest}
        onCancel={() => setRejectDialogItem(null)}
      />

      <GiveAdvanceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { loadData(); loadRequests(); }}
      />

      <BatchAdvanceModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        onSuccess={() => { loadData(); loadRequests(); }}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Advance Transaction"
        message="Are you sure you want to delete this advance transaction? This will affect the employee's running advance ledger balance."
        confirmText="Delete Transaction"
        requireReason={true}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default AdvancesPage;
