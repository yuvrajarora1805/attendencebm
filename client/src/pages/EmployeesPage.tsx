import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Eye, Palmtree } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Topbar from '../components/Topbar';
import DataTable, { Column } from '../components/DataTable';
import EmployeeModal from '../components/EmployeeModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

import SectionManagerModal from '../components/SectionManagerModal';
import { Layers } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { hasRole } = useAuth();
  const isManager = hasRole('manager') && !hasRole('admin');

  const loadData = async () => {
    try {
      setLoading(true);
      const [empRes, deptRes] = await Promise.all([
        api.get('/employees').catch(err => { console.error('Emp error', err); return { data: { data: [] } }; }),
        api.get('/employees/meta/departments').catch(() => ({ data: { data: [] } }))
      ]);
      setEmployees(empRes.data?.data || []);
      setDepartments(deptRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (reason: string) => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await api.delete(`/employees/${deleteId}`, { data: { reason } });
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<any>[] = [
    { 
      key: 'emp_code', 
      header: 'Emp Code', 
      width: '110px',
      render: (row) => (
        <span 
          style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }}
          onClick={(e) => { e.stopPropagation(); navigate(`/employees/${row.id}`); }}
          title="Click to view analytics, salary & history"
        >
          {row.emp_code}
        </span>
      )
    },
    { 
      key: 'name', 
      header: 'Name', 
      render: (row) => (
        <div>
          <span 
            style={{ cursor: 'pointer', color: 'inherit' }}
            onClick={(e) => { e.stopPropagation(); navigate(`/employees/${row.id}`); }}
            title="Click to view full analytics, salary & profile"
          >
            <strong style={{ color: 'var(--text-primary)' }}>{row.name}</strong>
          </span>
          {row.joining_date && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Joined: {row.joining_date.slice(0, 10)}
            </div>
          )}
        </div>
      )
    },
    { key: 'department_name', header: 'Department', render: (row) => row.department_name || row.dept_name || '—' },
    { key: 'job_role', header: 'Role', render: (row) => row.job_role || row.designation || 'Staff' },
    ...(isManager ? [] : [
      {
        key: 'basic_salary',
        header: 'Basic Salary',
        render: (row: any) => {
          const isPending = row.salary_approved === 0;
          return (
            <div>
              <div>Rs. {Number(row.basic_salary).toLocaleString()}</div>
              {isPending && (
                <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  ⚠️ Needs Approval
                </span>
              )}
              {row.monthly_advance_deduction > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Recov: ₹{Number(row.monthly_advance_deduction).toLocaleString()}/mo
                </div>
              )}
            </div>
          );
        }
      },
      {
        key: 'salary_per_day',
        header: 'Per Day',
        render: (row: any) => `Rs. ${Number(row.salary_per_day).toLocaleString()}`
      }
    ]),
    {
      key: 'monthly_leave_quota',
      header: 'Leave Limit',
      width: '120px',
      render: (row: any) => {
        const quota = row.monthly_leave_quota !== undefined && row.monthly_leave_quota !== null 
          ? Number(row.monthly_leave_quota) 
          : 2.0;

        const isStandard = quota === 2.0;
        const isZero = quota === 0;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={async () => {
                if (isManager) return;
                const inputVal = window.prompt(
                  `Update Monthly Allowed Leave Quota for ${row.name} (${row.emp_code}):\n\nEnter allowed paid leaves per month (0 to 31):`,
                  String(quota)
                );
                if (inputVal !== null && inputVal.trim() !== '') {
                  const newQuota = parseFloat(inputVal.trim());
                  if (!isNaN(newQuota) && newQuota >= 0 && newQuota <= 31) {
                    try {
                      await api.patch(`/employees/${row.id}/leave-quota`, { monthly_leave_quota: newQuota });
                      setEmployees(prev => prev.map(e => e.id === row.id ? { ...e, monthly_leave_quota: newQuota } : e));
                    } catch (err: any) {
                      alert(err.response?.data?.message || 'Failed to update leave quota');
                    }
                  } else {
                    alert('Please enter a valid quota number between 0 and 31 days.');
                  }
                }
              }}
              style={{
                cursor: isManager ? 'default' : 'pointer',
                border: 'none',
                borderRadius: '12px',
                padding: '4px 9px',
                fontSize: '11px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: isZero ? '#f1f5f9' : isStandard ? '#e0f2fe' : '#ede9fe',
                color: isZero ? '#64748b' : isStandard ? '#0369a1' : '#6d28d9',
                transition: 'all 0.2s ease'
              }}
              title={isManager ? 'Leave quota managed by Admin' : 'Click to quickly edit leave quota'}
            >
              <Palmtree size={12} />
              <span>{quota.toFixed(1)} d/mo</span>
              {!isManager && <Edit2 size={10} style={{ opacity: 0.6, marginLeft: '2px' }} />}
            </button>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {(quota * 12).toFixed(0)} d/yr
            </div>
          </div>
        );
      }
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => {
        if (row.referred_by_emp_name) {
          return (
            <div>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>Staff Ref</span>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>{row.referred_by_emp_name}</div>
            </div>
          );
        } else if (row.referred_by_name) {
          return (
            <div>
              <span className="badge badge-secondary" style={{ fontSize: '10px' }}>Outside Ref</span>
              <div style={{ fontSize: '11px' }}>{row.referred_by_name}</div>
            </div>
          );
        }
        return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Direct</span>;
      }
    },
    {
      key: 'increment',
      header: 'Tenure & Increment',
      render: (row) => {
        const rate = Number(row.increment_rate || 5);
        if (!row.joining_date) {
          return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isManager ? '—' : `Rate: ${rate}%`}</span>;
        }
        const join = new Date(row.joining_date);
        const currentYear = new Date().getFullYear();
        const diffYears = Math.floor((new Date().getTime() - join.getTime()) / (1000 * 60 * 60 * 24 * 365.25));

        // For current year, increments are already incorporated in salaries
        const lastIncYear = row.last_increment_date ? new Date(row.last_increment_date).getFullYear() : currentYear;
        const isUpToDate = lastIncYear >= currentYear || diffYears < 1;

        if (isUpToDate) {
          const incType = row.last_increment_type;
          let badgeText = `✓ ${currentYear} Done`;
          let badgeClass = 'badge badge-success';
          if (incType === 'no_increment') {
            badgeText = `No Increment (${currentYear})`;
            badgeClass = 'badge badge-secondary';
          } else if (incType === 'manual') {
            badgeText = `✓ Manual Inc (${currentYear})`;
            badgeClass = 'badge badge-info';
          }

          return (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {diffYears > 0 ? `${diffYears} Yr(s) Service` : '< 1 Yr Service'}
              </div>
              <span className={badgeClass} style={{ fontSize: '10px', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                {badgeText}
              </span>
            </div>
          );
        }

        const currentBasic = Number(row.basic_salary) || 0;
        const nextBasic = Math.round(currentBasic * (1 + rate / 100));

        return (
          <div>
            <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 700 }}>
              🎉 {diffYears} Yr(s) Completed
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Target (+{rate}%): <strong>₹{nextBasic.toLocaleString()}</strong>
            </div>
            {!isManager && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}
                  onClick={async () => {
                    if (confirm(`Apply ${rate}% annual increment to ${row.name}?\nCurrent Basic: ₹${currentBasic.toLocaleString()}\nNew Basic: ₹${nextBasic.toLocaleString()}`)) {
                      try {
                        const res = await api.post('/employees/increments/apply', { emp_id: row.id, increment_percent: rate });
                        alert(res.data.message);
                        loadData();
                      } catch (e: any) {
                        alert(e.response?.data?.message || 'Failed to apply increment');
                      }
                    }
                  }}
                >
                  +{rate}%
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600 }}
                  onClick={async () => {
                    const customVal = prompt(`Enter custom revised Basic Salary for ${row.name} (Current: ₹${currentBasic}):`, String(nextBasic));
                    if (customVal && !isNaN(Number(customVal)) && Number(customVal) > 0) {
                      const manualBasic = Number(customVal);
                      const notes = prompt(`Optional remarks for manual increment:`, 'Manual Increment');
                      try {
                        const res = await api.post('/employees/increments/apply', {
                          emp_id: row.id,
                          type: 'manual',
                          new_basic: manualBasic,
                          notes
                        });
                        alert(res.data.message);
                        loadData();
                      } catch (err: any) {
                        alert(err.response?.data?.message || 'Failed to apply manual increment');
                      }
                    }
                  }}
                  title="Manual custom salary"
                >
                  Manual
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 600, color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={async () => {
                    const reason = prompt(`Mark 'No Increment' for ${row.name} this cycle? Enter remarks (optional):`, 'No increment approved for this cycle');
                    if (reason !== null) {
                      try {
                        const res = await api.post('/employees/increments/apply', {
                          emp_id: row.id,
                          type: 'no_increment',
                          notes: reason
                        });
                        alert(res.data.message);
                        loadData();
                      } catch (e: any) {
                        alert(e.response?.data?.message || 'Failed to skip increment');
                      }
                    }
                  }}
                  title="Do NOT give increment this cycle"
                >
                  No Inc
                </button>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row) => {
        const isActive = row.status === 'active';
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}
              style={{ cursor: 'pointer', border: 'none', padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Click to toggle Active/Inactive"
              onClick={async () => {
                const newStatus = isActive ? 'inactive' : 'active';
                try {
                  await api.patch(`/employees/${row.id}/status`, { status: newStatus });
                  setEmployees(prev => prev.map(e => e.id === row.id ? { ...e, status: newStatus } : e));
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Failed to update employee status');
                }
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
              {row.status}
            </button>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '135px',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 6px' }}
            onClick={() => navigate(`/employees/${row.id}`)}
            title="View Analytics & Advance Details"
          >
            <Eye size={14} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 6px' }}
            onClick={() => { setSelectedEmp(row); setModalOpen(true); }}
            title="Edit Employee"
          >
            <Edit2 size={14} />
          </button>
          {hasRole('admin') && (
            <button
              className="btn btn-danger"
              style={{ padding: '4px 6px' }}
              onClick={() => setDeleteId(row.id)}
              title="Delete Employee"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  const filteredEmployees = employees.filter(emp => {
    if (selectedDept === 'all') return true;
    return String(emp.department_id) === String(selectedDept) || 
           String(emp.department_name || emp.dept_name || '').toLowerCase() === selectedDept.toLowerCase();
  });

  return (
    <div>
      <Topbar
        title="Employee Directory"
        subtitle="Manage workforce profiles, contracts, and salary structures"
        actions={
          hasRole('admin', 'hr', 'manager') ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSectionModalOpen(true)}
              >
                <Layers size={16} /> Manage Sections (Series)
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { setSelectedEmp(null); setModalOpen(true); }}
              >
                <UserPlus size={16} /> Add Employee
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="page-container">
        <DataTable
          columns={columns}
          data={filteredEmployees}
          loading={loading}
          searchPlaceholder="Search by name, code..."
          searchKey={(row) => `${row.name} ${row.emp_code} ${row.dept_name || row.department_name || ''}`}
          onRowClick={(row) => navigate(`/employees/${row.id}`)}
          extraControls={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Department:</span>
              <select
                className="form-input"
                style={{ height: '36px', fontSize: '13px', width: '220px', padding: '4px 10px' }}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="all">🏢 All Departments ({employees.length})</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.emp_count !== undefined ? `(${d.emp_count})` : ''}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      <EmployeeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
        employee={selectedEmp}
        departments={departments}
      />

      <SectionManagerModal
        isOpen={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        onUpdated={loadData}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Employee Record"
        message="Are you sure you want to delete this employee? This will remove their attendance and salary records unless archived."
        confirmText="Delete Employee"
        requireReason={true}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default EmployeesPage;
