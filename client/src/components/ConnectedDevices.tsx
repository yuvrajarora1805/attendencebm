import React, { useState, useEffect } from 'react';
import { Smartphone, HardDrive, Usb, CheckCircle2, Download, Folder, RefreshCw, ChevronRight, CornerLeftUp, RotateCcw } from 'lucide-react';
import api from '../api/client';
import ClientDeviceStorage from './datacontrol/ClientDeviceStorage';

export const ConnectedDevices: React.FC<{ latestSnapshotId?: number; onBackupCreated?: () => void }> = ({ onBackupCreated }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folders, setFolders] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [backupFiles, setBackupFiles] = useState<Array<{ name: string; fullPath: string; size: number; mtime: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const res = await api.get('/backup/devices');
      const list = res.data?.data || [];
      setDevices(list);
      if (list.length > 0) {
        const preferred = list.find((d: any) => d.tran === 'mtp') || list.find((d: any) => d.isUsb) || list[0];
        handleSelectDevice(preferred);
      }
    } catch (e) {
      console.warn('Devices error:', e);
    }
  };

  const loadFolder = async (pathStr: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/backup/browse-folders?path=${encodeURIComponent(pathStr)}`);
      setFolders(res.data?.folders || res.data?.data || []);
      setBackupFiles(res.data?.backupFiles || []);
      setCurrentPath(pathStr);
    } catch {
      setFolders([]);
      setBackupFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDevice = (dev: any) => {
    setSelectedDevice(dev);
    setStatusMsg(null);
    loadFolder(dev.mountpoint);
  };

  const handleGoUp = () => {
    if (!selectedDevice || currentPath === selectedDevice.mountpoint) return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
    loadFolder(parent.length >= selectedDevice.mountpoint.length ? parent : selectedDevice.mountpoint);
  };

  const handleSaveHere = async () => {
    if (!currentPath) return alert('Select a folder first.');
    try {
      setBusy(true);
      setStatusMsg(null);
      const res = await api.post('/backup/create');
      const snapId = res.data?.data?.id;
      const copyRes = await api.post('/backup/copy-to-device', { snapshot_id: snapId, target_folder: currentPath });
      setStatusMsg(`✅ Backup saved to:\n${copyRes.data?.data?.destFile || currentPath}`);
      loadFolder(currentPath);
      if (onBackupCreated) onBackupCreated();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: any) => {
    const reason = prompt(`Restore entire database from (${file.name})?\nReason:`, 'Restore from device');
    if (!reason) return;
    try {
      setBusy(true);
      setStatusMsg(null);
      const res = await api.post('/backup/restore-from-path', { file_path: file.fullPath, reason });
      alert(res.data?.message || 'System restored successfully!');
      if (onBackupCreated) onBackupCreated();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  const getIcon = (dev: any) => (dev.tran === 'mtp' || dev.model.includes('Phone')) ? <Smartphone size={16} /> : (dev.isUsb || dev.tran === 'usb') ? <Usb size={16} /> : <HardDrive size={16} />;

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      {/* 1. Client Device Storage (The PC/Phone opening the browser tab) */}
      <ClientDeviceStorage onBackupSuccess={onBackupCreated} />

      {/* 2. Host Server Storage (192.168.1.13) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Folder size={17} color="var(--primary-600)" /> Host Server Drives & Folder Explorer (192.168.1.13)
          </h4>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Browse server-attached drives, USBs, and MTP devices directly on the hosting machine.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadDevices} style={{ padding: '4px 10px', fontSize: '11px' }}>
          <RefreshCw size={12} /> Refresh Server Drives
        </button>
      </div>

      {/* Storage Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        {devices.map((d) => {
          const sel = selectedDevice?.mountpoint === d.mountpoint;
          return (
            <div key={d.mountpoint} onClick={() => handleSelectDevice(d)} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: sel ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', background: sel ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: sel ? 'var(--accent-primary)' : 'inherit' }}>
                  {getIcon(d)} {d.model}
                </span>
                <span className={`badge ${d.tran === 'mtp' ? 'badge-success' : d.isUsb ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: '10px' }}>
                  {d.tran === 'mtp' ? 'Phone' : d.isUsb ? 'USB' : 'Disk'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.mountpoint.split('/').slice(-2).join('/')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Folder Explorer */}
      {selectedDevice && (
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '260px', overflowX: 'auto', fontSize: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleGoUp} disabled={currentPath === selectedDevice.mountpoint} style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CornerLeftUp size={13} /> Up
              </button>
              <code style={{ fontSize: '11px', background: 'var(--glass-bg)', padding: '4px 8px', borderRadius: '4px', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentPath.replace(selectedDevice.mountpoint, selectedDevice.model)}
              </code>
            </div>

            <button className="btn btn-primary" onClick={handleSaveHere} disabled={busy} style={{ padding: '7px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> {busy ? 'Saving...' : 'Save Complete Backup Here'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading folder contents...</div>
          ) : (
            <div>
              {/* Folders List */}
              {folders.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '6px', marginBottom: '12px' }}>
                  {folders.map((f) => {
                    const isBkp = f.name.toLowerCase().includes('backup') || f.name.toLowerCase().includes('attendance');
                    return (
                      <div key={f.fullPath} onClick={() => loadFolder(f.fullPath)} style={{ padding: '6px 10px', borderRadius: '6px', background: isBkp ? 'rgba(16, 185, 129, 0.12)' : 'var(--glass-bg)', border: isBkp ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isBkp ? 600 : 400, color: isBkp ? 'var(--accent-primary)' : 'inherit' }}>
                          <Folder size={13} color={isBkp ? 'var(--accent-primary)' : '#60a5fa'} /> {f.name}
                        </span>
                        <ChevronRight size={12} color="var(--text-muted)" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Backups in Folder */}
              {backupFiles.length > 0 ? (
                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCcw size={13} /> Backups in this Folder ({backupFiles.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {backupFiles.map((b) => (
                      <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--glass-bg)', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '6px' }}>
                        <div>
                          <strong>{b.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {(b.size / 1024).toFixed(1)} KB • {new Date(b.mtime).toLocaleString()}
                          </div>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleRestoreFile(b)} disabled={busy} style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <RotateCcw size={12} /> {busy ? 'Restoring...' : 'Restore from this Backup'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : folders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  No backup files in this folder. Click "Save Complete Backup Here" above to save one.
                </div>
              ) : null}
            </div>
          )}

          {statusMsg && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-primary)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span style={{ whiteSpace: 'pre-wrap' }}>{statusMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectedDevices;
