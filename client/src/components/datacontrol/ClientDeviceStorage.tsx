import React, { useState, useRef } from 'react';
import { Laptop, Folder, Save, Upload, CheckCircle2, FolderPlus } from 'lucide-react';
import api from '../../api/client';

export const ClientDeviceStorage: React.FC<{ onBackupSuccess?: () => void }> = ({ onBackupSuccess }) => {
  const [selectedDirName, setSelectedDirName] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDevicePlatform = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return 'Android Device (Current)';
    if (/iphone|ipad/i.test(ua)) return 'iOS Device (Current)';
    if (/windows/i.test(ua)) return 'Windows PC (This Computer)';
    if (/mac/i.test(ua)) return 'Mac (This Computer)';
    return 'Client Device (This Computer)';
  };

  const hasDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const hasSaveFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  const handlePickDirectory = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      setSelectedDirName(handle.name);
      setStatusMsg(`Selected default folder: "${handle.name}"`);
    } catch (err: any) {
      if (err.name !== 'AbortError') alert('Could not access folder on this device.');
    }
  };

  const generateBackupBlob = async () => {
    setStatusMsg('Generating latest database backup...');
    const snapRes = await api.post('/backup/create');
    const snapId = snapRes.data?.data?.id;
    const snapName = snapRes.data?.data?.snapshotName || `backup_${Date.now()}.zip`;
    const downloadRes = await api.get(`/backup/download/${snapId}`, { responseType: 'blob' });
    return { blob: new Blob([downloadRes.data], { type: 'application/zip' }), snapName };
  };

  const writeBlobToHandle = async (fileHandle: any, blob: Blob) => {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  // 1. Save directly into pre-selected folder / USB drive
  const handleSaveToSelectedFolder = async () => {
    if (!dirHandle) return handleSaveAsOtherLocation();
    try {
      setBusy(true);
      const { blob, snapName } = await generateBackupBlob();
      const fileHandle = await dirHandle.getFileHandle(snapName, { create: true });
      await writeBlobToHandle(fileHandle, blob);
      setStatusMsg(`✅ Written directly to: "${selectedDirName}/${snapName}"`);
      if (onBackupSuccess) onBackupSuccess();
    } catch (err: any) {
      if (err.name !== 'AbortError') alert(err.response?.data?.message || err.message || 'Failed to save');
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  };

  // 2. Save to another location on this device (prompts native OS File Dialog)
  const handleSaveAsOtherLocation = async () => {
    try {
      setBusy(true);
      const { blob, snapName } = await generateBackupBlob();

      if (hasSaveFilePicker) {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: snapName,
          types: [{ description: 'AttendPro Backup (.zip)', accept: { 'application/zip': ['.zip'] } }]
        });
        await writeBlobToHandle(fileHandle, blob);
        setStatusMsg(`✅ Saved directly to chosen path: "${fileHandle.name}"`);
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = snapName; a.click();
        window.URL.revokeObjectURL(url);
        setStatusMsg(`✅ Backup saved to this device: ${snapName}`);
      }
      if (onBackupSuccess) onBackupSuccess();
    } catch (err: any) {
      if (err.name !== 'AbortError') alert(err.response?.data?.message || err.message || 'Save failed');
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reason = prompt(`Restore database from file "${file.name}" on this PC?\nEnter reason:`, 'Restoring from client PC');
    if (!reason) return;

    try {
      setBusy(true);
      setStatusMsg(`Uploading "${file.name}" to server...`);
      const formData = new FormData();
      formData.append('file', file);
      const upRes = await api.post('/backup/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const snapId = upRes.data?.id || upRes.data?.snapshot_id || upRes.data?.data?.id;

      if (snapId) {
        setStatusMsg('Restoring database records...');
        await api.post(`/backup/restore/${snapId}`, { reason });
        alert(`Database successfully restored from "${file.name}"!`);
        setStatusMsg(`✅ Restored from "${file.name}"`);
        if (onBackupSuccess) onBackupSuccess();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Restore failed');
      setStatusMsg(null);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Laptop size={20} color="var(--primary-600)" />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{getDevicePlatform()}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Direct Device Storage · {selectedDirName ? `Active Folder: ${selectedDirName}` : 'Choose Any Drive or Folder'}
            </div>
          </div>
        </div>
        <span className="badge badge-success" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={11} /> This Device Connected
        </span>
      </div>

      {statusMsg && (
        <div style={{ fontSize: '12px', padding: '6px 10px', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--primary-700)', borderRadius: '6px', marginBottom: '10px', fontWeight: 600 }}>
          {statusMsg}
        </div>
      )}

      {typeof window !== 'undefined' && !window.isSecureContext && (
        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', background: 'rgba(2, 132, 199, 0.07)', border: '1px solid rgba(2, 132, 199, 0.2)', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>💡 <strong>To choose folder/USB on this PC:</strong> In browser <em>Settings → Downloads</em>, turn ON <strong>"Ask where to save each file before downloading"</strong> so it prompts your USB or folder instead of default Downloads.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {selectedDirName ? (
          <button className="btn btn-primary btn-sm" onClick={handleSaveToSelectedFolder} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} />
            <span>Save to "{selectedDirName}"</span>
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleSaveAsOtherLocation} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Save size={13} />
            <span>Save to This Device (Choose Location)...</span>
          </button>
        )}

        {selectedDirName && (
          <button className="btn btn-secondary btn-sm" onClick={handleSaveAsOtherLocation} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '5px' }} title="Choose another folder, drive or USB on this PC">
            <FolderPlus size={13} color="var(--primary-600)" />
            <span>Save to Other Location...</span>
          </button>
        )}

        {hasDirectoryPicker && (
          <button className="btn btn-secondary btn-sm" onClick={handlePickDirectory} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Folder size={13} />
            <span>{selectedDirName ? 'Change Folder' : 'Set Default Folder / USB'}</span>
          </button>
        )}

        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Upload size={13} color="var(--accent-success)" />
          <span>Restore Backup from This PC</span>
        </button>

        <input type="file" ref={fileInputRef} onChange={handleRestoreFromFile} accept=".json,.zip" style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default ClientDeviceStorage;
