import React, { useState, useEffect } from 'react';
import { ShieldAlert, Archive, Trash2 } from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';
import ConfirmDialog from '../components/ConfirmDialog';
import AttachedDevicesWidget from '../components/datacontrol/AttachedDevicesWidget';
import DataCoverageTimeline, { CoverageReport } from '../components/datacontrol/DataCoverageTimeline';
import ServerArchivesTable from '../components/datacontrol/ServerArchivesTable';

export const DataControlPage: React.FC = () => {
  const [module, setModule] = useState<'attendance' | 'salary' | 'all'>('attendance');
  const [dateFrom, setDateFrom] = useState('2025-08-01');
  const [dateTo, setDateTo] = useState('2025-08-31');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [archivesList, setArchivesList] = useState<any[]>([]);
  const [coverageData, setCoverageData] = useState<CoverageReport | null>(null);
  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [restoreArchiveId, setRestoreArchiveId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [covRes, archRes] = await Promise.all([
        api.get('/data-control/coverage'),
        api.get('/data-control/archives')
      ]);
      setCoverageData(covRes.data?.coverage || null);
      setDevicesList(covRes.data?.devices || []);
      setArchivesList(archRes.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const setPreset = (type: 'aug25' | '30d' | '90d' | 'all') => {
    setPreviewCount(null);
    const now = new Date();
    if (type === 'aug25') { setDateFrom('2025-08-01'); setDateTo('2025-08-31'); }
    else if (type === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().split('T')[0]); setDateTo(now.toISOString().split('T')[0]);
    } else if (type === '90d') {
      const d = new Date(); d.setDate(d.getDate() - 90);
      setDateFrom(d.toISOString().split('T')[0]); setDateTo(now.toISOString().split('T')[0]);
    } else { setDateFrom('2020-01-01'); setDateTo('2026-12-31'); }
  };

  const handlePreview = async () => {
    if (!dateFrom || !dateTo) return alert('Select date range');
    try {
      setLoading(true);
      const res = await api.post('/data-control/preview', { module, date_from: dateFrom, date_to: dateTo });
      const p = res.data?.preview || {};
      setPreviewCount(module === 'all' ? (p.attendance || 0) + (p.salary || 0) : (p[module] ?? 0));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectDelete = async (reason: string) => {
    try {
      setLoading(true);
      const res = await api.post('/data-control/delete-direct', {
        module, date_from: dateFrom, date_to: dateTo, confirm_text: 'DELETE CONFIRMED', reason
      });
      alert(res.data?.message || 'Records safely deleted from server.');
      setConfirmDeleteOpen(false);
      setPreviewCount(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArchive = async () => {
    try {
      setLoading(true);
      const res = await api.post('/data-control/archive', {
        module, date_from: dateFrom, date_to: dateTo, reason: `Manual archive (${module}: ${dateFrom} to ${dateTo})`
      });
      alert(`Archive created successfully (#${res.data?.archive_id})!`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Archive creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRestore = async (reason: string) => {
    if (!restoreArchiveId) return;
    try {
      setLoading(true);
      const res = await api.post('/data-control/restore', { archive_id: restoreArchiveId, reason });
      alert(res.data?.message || 'Records restored successfully to server!');
      setRestoreArchiveId(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArchive = async (id: number) => {
    if (!window.confirm(`Permanently remove archive #${id} from the server?`)) return;
    try {
      setLoading(true);
      await api.delete(`/data-control/archives/${id}`);
      alert(`Archive #${id} deleted from server.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Topbar title="Data Control & Archival" subtitle="Delete data by custom duration, monitor server coverage & attached devices" />

      <div className="page-container" style={{ maxWidth: '1000px' }}>
        {/* Attached Devices Widget */}
        <AttachedDevicesWidget devices={devicesList} loading={loading} onRefresh={loadData} />

        {/* Server Data Timeline & Missing Durations */}
        <DataCoverageTimeline coverage={coverageData} onSelectDuration={(f, t) => { setDateFrom(f); setDateTo(t); setPreviewCount(null); }} />

        {/* Delete Data & Duration Scope */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} color="var(--accent-warning)" />
            Delete Data from Server (Custom Duration)
          </h3>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Duration Presets:</span>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setPreset('aug25')}>August 2025</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setPreset('30d')}>Older than 30d</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setPreset('90d')}>Older than 90d</button>
            <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setPreset('all')}>All Historical</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Target Module</label>
              <select className="form-input" value={module} onChange={(e: any) => { setModule(e.target.value); setPreviewCount(null); }}>
                <option value="attendance">Attendance Records</option>
                <option value="salary">Salary Records</option>
                <option value="all">All Modules (Attendance + Salary)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input type="date" className="form-input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreviewCount(null); }} />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreviewCount(null); }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
              Preview Records {previewCount !== null ? `(${previewCount} found)` : ''}
            </button>
            <button className="btn btn-danger" onClick={() => setConfirmDeleteOpen(true)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={15} /> Delete Data from Server
            </button>
            <button className="btn btn-secondary" onClick={handleCreateArchive} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={15} /> Save Archive Only
            </button>
          </div>
        </div>

        {/* Server Archives & Management */}
        <ServerArchivesTable
          archives={archivesList}
          onRestore={setRestoreArchiveId}
          onDeleteArchive={handleDeleteArchive}
        />
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Confirm Deleting Data from Server"
        message={`All ${module} records between ${dateFrom} and ${dateTo} will be safely deleted from the server. An automatic SHA-256 safety snapshot will be created first so you can restore them anytime.`}
        exactMatchWord="DELETE CONFIRMED"
        requireReason={true}
        confirmText="Permanently Delete Matching Records"
        onConfirm={handleDirectDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        loading={loading}
      />

      <ConfirmDialog
        isOpen={restoreArchiveId !== null}
        title="Restore Selected Archive to Server"
        message="Records from this archive will be restored back into the live database tables without duplicates."
        requireReason={true}
        confirmText="Restore Records to Live Server"
        onConfirm={handleExecuteRestore}
        onCancel={() => setRestoreArchiveId(null)}
        loading={loading}
      />
    </div>
  );
};

export default DataControlPage;
