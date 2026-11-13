import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  archives: any[];
  onRestore: (id: number) => void;
  onDeleteArchive: (id: number) => void;
}

export const ServerArchivesTable: React.FC<Props> = ({
  archives,
  onRestore,
  onDeleteArchive,
}) => {
  return (
    <div className="card">
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Server Archives & Data Management</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th>Archive ID</th>
              <th>Module</th>
              <th>Date Duration</th>
              <th>Records</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {archives.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  No archives stored on server yet.
                </td>
              </tr>
            ) : (
              archives.map((a) => (
                <tr key={a.id}>
                  <td><strong>#{a.id}</strong></td>
                  <td style={{ textTransform: 'capitalize' }}>{a.module}</td>
                  <td>
                    {a.date_from ? a.date_from.slice(0, 10) : 'Start'} to {a.date_to ? a.date_to.slice(0, 10) : 'End'}
                  </td>
                  <td><strong>{a.record_count}</strong></td>
                  <td>
                    <span className={`badge ${a.status === 'restored' ? 'badge-info' : a.status === 'deleted' ? 'badge-warning' : 'badge-success'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => onRestore(a.id)}
                        title="Restore records from this archive to live server database"
                      >
                        <RotateCcw size={11} /> {a.status === 'restored' ? 'Re-restore' : 'Restore to Server'}
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)' }}
                        onClick={() => onDeleteArchive(a.id)}
                        title="Permanently remove this archive from server storage"
                      >
                        <Trash2 size={11} /> Delete from Server
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServerArchivesTable;
