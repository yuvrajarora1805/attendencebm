import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  exactMatchWord?: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm Action',
  exactMatchWord,
  requireReason = false,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const [typedWord, setTypedWord] = useState('');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const canSubmit = (!exactMatchWord || typedWord === exactMatchWord) &&
    (!requireReason || reason.trim().length >= 3);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-danger)' }}>
              <AlertTriangle size={22} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>
          </div>
          <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
          {message}
        </p>

        {exactMatchWord && (
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">
              Type <strong style={{ color: 'var(--accent-danger)' }}>{exactMatchWord}</strong> to confirm:
            </label>
            <input
              type="text"
              className="form-input"
              value={typedWord}
              onChange={(e) => setTypedWord(e.target.value)}
              placeholder={`Enter "${exactMatchWord}"`}
            />
          </div>
        )}

        {requireReason && (
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Reason for this action (Audit Trail):</label>
            <input
              type="text"
              className="form-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Yearly data archival per retention policy"
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={!canSubmit || loading}
            onClick={() => onConfirm(reason)}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
