import React from 'react';
import { Smartphone, HardDrive, Usb, ArrowRight, RefreshCw, CheckCircle2, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ClientDeviceStorage from './ClientDeviceStorage';

interface StorageDevice {
  name: string;
  mountpoint: string;
  size: string;
  model: string;
  isUsb: boolean;
  tran: string;
}

interface Props {
  devices: StorageDevice[];
  loading: boolean;
  onRefresh: () => void;
}

export const AttachedDevicesWidget: React.FC<Props> = ({ devices, loading, onRefresh }) => {
  const navigate = useNavigate();

  const getDeviceIcon = (dev: StorageDevice) => {
    if (dev.mountpoint?.toLowerCase().includes('mtp') || dev.model?.toLowerCase().includes('oneplus') || dev.model?.toLowerCase().includes('phone')) {
      return <Smartphone size={18} color="#10b981" />;
    }
    if (dev.isUsb || dev.tran === 'usb') {
      return <Usb size={18} color="#0284c7" />;
    }
    return <HardDrive size={18} color="#8b5cf6" />;
  };

  const getDeviceLabel = (dev: StorageDevice) => {
    if (dev.mountpoint?.toLowerCase().includes('mtp') || dev.model?.toLowerCase().includes('oneplus')) {
      return 'Mobile Phone (MTP Storage)';
    }
    if (dev.isUsb) return 'External USB Drive';
    return dev.model || 'Storage Disk';
  };

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      {/* Storage for This PC / Current Browser Device */}
      <ClientDeviceStorage onBackupSuccess={onRefresh} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Server size={16} color="var(--primary-600)" />
          Host Server Storage Devices ({devices.length} Detected on 192.168.1.13)
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={onRefresh} disabled={loading} title="Refresh server devices">
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Server
          </button>
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => navigate('/backup')}>
            <span>Backup & Restore Page</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
          No external storage detected. Connect phone via MTP or plug in USB drive.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {devices.map((dev, i) => (
            <div key={i} style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {getDeviceIcon(dev)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {getDeviceLabel(dev)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dev.mountpoint} · {dev.size}
                  </div>
                </div>
              </div>
              <span className="badge badge-success" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={10} /> Ready
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachedDevicesWidget;
