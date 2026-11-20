import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import api from '../api/client';

export interface EditAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: any | null;
}

const formatTimeToHHMM = (val: any): string => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatDateToYYYYMMDD = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string' && val.length >= 10 && val.includes('-')) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
};

export const EditAttendanceModal: React.FC<EditAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  record
}) => {
  const [date, setDate] = useState('');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [status, setStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setDate(formatDateToYYYYMMDD(record.date || record.punch_in || new Date()));
      setInTime(formatTimeToHHMM(record.punch_in));
      setOutTime(formatTimeToHHMM(record.punch_out));
      setStatus(record.status || (record.punch_in ? 'present' : 'absent'));
      setReason(record.correction_reason || record.notes || '');
      setError(null);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  // Calculate live shift preview
  const shiftPreview = (() => {
    if (!inTime) return null;
    if (!outTime) return { text: `Punch IN at ${inTime}`, hrs: null };
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let mins = (outH * 60 + outM) - (inH * 60 + inM);
    if (mins < 0) mins += 24 * 60; // cross-midnight
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    return { text: `${hrs}h ${remM}m`, hrs, mins };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record.id && !record.attendance_record_id && !record.record_id) {
      setError('Invalid record ID');
      return;
    }

    setSubmitting(true);
    setError(null);

    const recordId = record.id || record.attendance_record_id || record.record_id;

    try {
      await api.put(`/attendance/record/${recordId}`, {
        date,
        punch_in: inTime || null,
        punch_out: outTime || null,
        status,
        reason: reason.trim() || 'Manual punch time update by admin',
        notes: reason.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update attendance record:', err);
      setError(err.response?.data?.message || 'Failed to update attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  const QUICK_REASONS = [
    'Biometric machine failure',
    'Forgot to punch OUT',
    'Approved late arrival',
    'Manager verified shift',
    'Outdoor official duty'
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: 0,
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          background: 'var(--surface-color, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          animation: 'fadeInScale 0.15s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>✏️</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Edit Attendance Punch
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ color: '#38bdf8' }}>{record.name || record.emp_name}</strong>
              <span>•</span>
              <span style={{ background: '#334155', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', color: '#e2e8f0', fontWeight: 600 }}>
                Code: {record.emp_code}
              </span>
              {(record.department_name || record.dept_name) && (
                <>
                  <span>•</span>
                  <span>{record.department_name || record.dept_name}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Date & Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} style={{ color: '#64748b' }} /> Attendance Date
              </label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                style={{ fontSize: '13px' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} style={{ color: '#64748b' }} /> Attendance Status
              </label>
              <select
                className="form-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                <option value="present">🟢 Present</option>
                <option value="late">🟠 Late</option>
                <option value="half_day">🟡 Half Day</option>
                <option value="absent">🔴 Absent</option>
                <option value="leave">🌴 Leave</option>
                <option value="weekly_off">⚪ Weekly Off</option>
              </select>
            </div>
          </div>

          {/* Punch IN & OUT Section */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: '#0284c7' }} /> Punch Time Adjustments
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
              {/* Punch IN */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', margin: 0 }}>
                    🟢 Punch IN Time
                  </label>
                  {inTime && (
                    <button
                      type="button"
                      onClick={() => setInTime('')}
                      style={{ fontSize: '10px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Clear punch in"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  className="form-input"
                  value={inTime}
                  onChange={e => setInTime(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 700, padding: '7px 8px' }}
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setInTime('09:00')}
                    style={{ fontSize: '10px', padding: '2px 6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                  >
                    09:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setInTime('09:30')}
                    style={{ fontSize: '10px', padding: '2px 6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                  >
                    09:30
                  </button>
                </div>
              </div>

              {/* Punch OUT */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', margin: 0 }}>
                    🔵 Punch OUT Time
                  </label>
                  {outTime && (
                    <button
                      type="button"
                      onClick={() => setOutTime('')}
                      style={{ fontSize: '10px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Clear punch out"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  className="form-input"
                  value={outTime}
                  onChange={e => setOutTime(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 700, padding: '7px 8px' }}
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setOutTime('18:00')}
                    style={{ fontSize: '10px', padding: '2px 6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                  >
                    18:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutTime('18:30')}
                    style={{ fontSize: '10px', padding: '2px 6px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                  >
                    18:30
                  </button>
                </div>
              </div>
            </div>

            {/* Shift duration summary banner */}
            {shiftPreview && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#475569'
                }}
              >
                <span>
                  Shift: <strong>{inTime || '—'}</strong> ➔ <strong>{outTime || '—'}</strong>
                </span>
                {shiftPreview.hrs !== null && (
                  <span style={{ fontWeight: 800, color: '#0284c7' }}>
                    ⏱️ Total Duration: {shiftPreview.text}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Reason / Audit Note */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
              Correction Reason / Audit Remarks *
            </label>
            <input
              type="text"
              className="form-input"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Fingerprint missed, verified by Shift Supervisor"
              required
              style={{ fontSize: '13px', marginBottom: '6px' }}
            />
            {/* Quick Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {QUICK_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setReason(r)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    background: reason === r ? '#e0f2fe' : '#ffffff',
                    color: reason === r ? '#0369a1' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  + {r}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? '⏳ Saving...' : '💾 Save Attendance Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAttendanceModal;
