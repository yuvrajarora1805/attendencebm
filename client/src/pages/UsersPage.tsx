import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Shield, X, KeyRound, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import DataTable, { Column } from '../components/DataTable';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'viewer', full_name: '' });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/users', formData);
      setModalOpen(false);
      setFormData({ username: '', password: '', role: 'viewer', full_name: '' });
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<any>[] = [
    { key: 'username', header: 'Username', render: (r) => <strong>{r.username}</strong> },
    { key: 'full_name', header: 'Full Name', render: (r) => r.full_name || '—' },
    {
      key: 'role',
      header: 'Role',
      render: (r) => {
        let cls = 'badge-info';
        if (r.role === 'admin') cls = 'badge-danger';
        if (r.role === 'guard') cls = 'badge-warning';
        if (r.role === 'payroll') cls = 'badge-success';
        return <span className={`badge ${cls}`} style={{ textTransform: 'uppercase' }}>{r.role}</span>;
      }
    },
    { key: 'created_at', header: 'Created', render: (r) => new Date(r.created_at).toLocaleDateString() }
  ];

  return (
    <div>
      <Topbar
        title="User & Access Control"
        subtitle="Manage operators, security guard credentials, and administrative privileges"
        actions={
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add User
          </button>
        }
      />

      <div className="page-container">
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          searchPlaceholder="Search users by name or role..."
          searchKey={(r) => `${r.username} ${r.full_name || ''} ${r.role}`}
        />
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Create New User Account</h3>
              <button className="btn btn-secondary" style={{ padding: '4px' }} onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. guard1 or hr_manager"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Main Gate Guard"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Password *</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-muted, #94a3b8)',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">System Role *</label>
                <select
                  className="form-input"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="guard">Guard (Punch In/Out screen only)</option>
                  <option value="manager">Manager (Attendance & Custom Time Punch)</option>
                  <option value="payroll">Payroll Specialist</option>
                  <option value="hr">HR Specialist</option>
                  <option value="admin">Super Admin (Full access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
