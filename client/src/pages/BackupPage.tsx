import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, CheckCircle, ShieldCheck, Download, RotateCcw, Upload, Trash2, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import ConfirmDialog from '../components/ConfirmDialog';
import ConnectedDevices from '../components/ConnectedDevices';

export const BackupPage: React.FC = () => {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSnapshots = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backup');
      setSnapshots(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSnapshots(); }, []);

  const handleCreateSnapshot = async () => {
    try {
      setCreating(true);
      const res = await api.post('/backup/create');
      alert(`Full system backup created successfully!\nFile: ${res.data?.data?.snapshotName}`);
      loadSnapshots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id: number) => {
    try {
      const res = await api.post(`/backup/verify/${id}`);
      if (res.data?.verified) {
        alert('Integrity check PASSED! SHA-256 hash matches the exact file on disk.');
      } else {
        alert('Integrity check FAILED! File has been altered or corrupted.');
      }
      loadSnapshots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleRestore = async (reason: string) => {
    if (!restoreId) return;
    try {
      setRestoring(true);
      const res = await api.post(`/backup/restore/${restoreId}`, { reason });
      alert(res.data?.message || 'Full database restored successfully!');
      setRestoreId(null);
      loadSnapshots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/backup/${deleteId}`);
      setDeleteId(null);
      loadSnapshots();
    } catch (err: any) {
      alert('Failed to delete snapshot');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/backup/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('Backup file uploaded and registered in snapshot list!');
      loadSnapshots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to upload backup file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <Topbar
        title="Complete System Backup & Restore"
        subtitle="1-Click complete database backup (all employees, salary, attendance, departments, settings) & disaster recovery"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json,.zip" style={{ display: 'none' }} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> Upload Backup File
            </button>
            <button className="btn btn-primary" onClick={handleCreateSnapshot} disabled={creating}>
              <Database size={15} /> {creating ? 'Backing Up...' : 'Create Full System Backup'}
            </button>
          </div>
        }
      />

      <div className="page-container">
        <ConnectedDevices latestSnapshotId={snapshots[0]?.id} onBackupCreated={loadSnapshots} />

        <div className="card" style={{ padding: '0', overflowX: 'auto', marginBottom: '24px' }}>
          <table className="data-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th>Backup File Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>SHA-256 Checksum</th>
                <th>Date & Time</th>
                <th>Integrity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}><span className="spinner" /> Loading snapshots...</td></tr>
              ) : snapshots.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>No backups taken yet. Click "Create Full System Backup" above.</td></tr>
              ) : (
                snapshots.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.snapshot_name}</strong></td>
                    <td><span className="badge badge-info">Full DB</span></td>
                    <td>{(s.file_size_bytes / 1024).toFixed(1)} KB</td>
                    <td><code style={{ fontSize: '11px' }}>{s.checksum?.slice(0, 16)}...</code></td>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>
                      {s.verified ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} /> Verified
                        </span>
                      ) : (
                        <span className="badge badge-warning">Unchecked</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-primary)' }}
                          onClick={() => setRestoreId(s.id)}
                          title="Restore Entire System"
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleVerify(s.id)}
                          title="Verify File Hash"
                        >
                          <ShieldCheck size={13} /> Verify
                        </button>
                        <a
                          href={`/api/backup/download/${s.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          title="Download Backup File"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => setDeleteId(s.id)}
                          title="Delete Backup"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} /> Complete System Backup Explained
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Every backup is a <strong>complete snapshot of all 10 tables</strong> (Employees, Departments, Shift Schedules, Attendance Records, Salary Periods, Salary Entries, Advances, System Settings). When you restore, the whole system returns to that exact state with complete consistency. You can also download the file to a USB drive or upload it on a new computer.
          </p>
        </div>
      </div>

      <ConfirmDialog
        isOpen={restoreId !== null}
        title="Confirm Full System Database Restore"
        message="Restoring this backup will replace current records across all tables with the state from this backup file. All actions are audit-logged."
        exactMatchWord="RESTORE DATABASE"
        requireReason={true}
        confirmText="Restore Complete System"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setRestoreId(null)}
      />

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Backup File"
        message="Are you sure you want to delete this backup snapshot from the server?"
        confirmText="Delete Backup"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default BackupPage;
