import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import SearchableEmployeeSelect, { EmployeeOption } from './SearchableEmployeeSelect';

interface ManualPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultEmpCode?: string;
}

export const ManualPunchModal: React.FC<ManualPunchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  defaultEmpCode
}) => {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [punchDate, setPunchDate] = useState<string>(
    defaultDate || new Date().toISOString().split('T')[0]
  );
  const [punchAction, setPunchAction] = useState<'both' | 'auto' | 'in' | 'out'>('both');
  const [inTime, setInTime] = useState<string>('09:00');
  const [outTime, setOutTime] = useState<string>('18:00');
  const [singleTime, setSingleTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/employees?status=active')
        .then(res => {
          if (res.data?.data) {
            setEmployees(res.data.data);
            if (defaultEmpCode) {
              const matched = res.data.data.find(
                (e: any) => e.emp_code?.toUpperCase() === defaultEmpCode.toUpperCase()
              );
              if (matched) setSelectedEmpId(String(matched.id));
            }
          }
        })
        .catch(err => console.error('Failed to load employees for punch modal', err));

      if (defaultDate) {
        setPunchDate(defaultDate);
      }
    } else {
      setError(null);
      setNotes('');
    }
  }, [isOpen, defaultDate, defaultEmpCode]);

  if (!isOpen) return null;

  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId));
  const isToday = punchDate === new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) {
      setError('Please select an active employee');
      return;
    }
    if (!punchDate) {
      setError('Please select an attendance date');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        emp_code: selectedEmp.emp_code,
        action: punchAction,
        punch_date: punchDate,
      };

      if (punchAction === 'both') {
        payload.in_time = inTime;
        payload.out_time = outTime;
      } else {
        payload.punch_time = singleTime;
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      const res = await api.post('/attendance/punch', payload);
      alert(`✅ ${res.data.emp_name || selectedEmp.name}: ${res.data.message || 'Punch recorded successfully'} (${punchDate})`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record attendance punch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1050,
      background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--border-color)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'var(--accent-primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Record Attendance Punch</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Punch for Today or Any Custom / Backdated Date
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{
              marginBottom: '14px', padding: '10px 12px', borderRadius: '8px',
              background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
              fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Action Toggle */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Punch Action Type
            </label>
            <div style={{
              display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px',
              padding: '3px', border: '1px solid var(--border-color)'
            }}>
              {(['both', 'auto', 'in', 'out'] as const).map(act => (
                <button
                  type="button"
                  key={act}
                  onClick={() => setPunchAction(act)}
                  style={{
                    flex: 1, padding: '7px 2px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                    border: 'none', cursor: 'pointer',
                    background: punchAction === act ? 'var(--accent-primary)' : 'transparent',
                    color: punchAction === act ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {act === 'both' ? '⏱️ BOTH (IN+OUT)' : act === 'auto' ? '⚡ AUTO' : act === 'in' ? '🟢 IN' : '🔵 OUT'}
                </button>
              ))}
            </div>
          </div>

          {/* Employee Selector */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Employee *
            </label>
            <SearchableEmployeeSelect
              employees={employees}
              value={selectedEmpId}
              onChange={(id) => setSelectedEmpId(id)}
              placeholder="Search by code (e.g. 1375) or name..."
              required
            />
          </div>

          {/* Custom Date Input */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={13} color="var(--accent-primary)" /> Attendance Date *
              </label>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setPunchDate(new Date().toISOString().split('T')[0])}
                  style={{
                    padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '4px',
                    border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer'
                  }}
                >
                  Reset Today
                </button>
              )}
            </div>
            <input
              type="date"
              className="form-input"
              value={punchDate}
              onChange={e => setPunchDate(e.target.value)}
              required
              style={{
                fontSize: '13px', fontWeight: 700,
                background: !isToday ? '#fffbeb' : undefined,
                borderColor: !isToday ? '#f59e0b' : undefined
              }}
            />
            {!isToday && (
              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '3px' }}>
                ⚠️ Custom Date: Punching for backdated / custom date <strong>{punchDate}</strong>
              </div>
            )}
          </div>

          {/* Time Controls */}
          {punchAction === 'both' ? (
            <div style={{
              background: 'rgba(2, 132, 199, 0.06)', borderRadius: '10px', padding: '12px',
              marginBottom: '14px', border: '1px solid rgba(2, 132, 199, 0.25)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', marginBottom: '3px' }}>
                    🟢 Punch IN Time *
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={inTime}
                    onChange={e => setInTime(e.target.value)}
                    required
                    style={{ fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', marginBottom: '3px' }}>
                    🔵 Punch OUT Time *
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={outTime}
                    onChange={e => setOutTime(e.target.value)}
                    required
                    style={{ fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{
                fontSize: '11px', background: '#ffffff', border: '1px solid #cbd5e1',
                borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between',
                color: '#475569'
              }}>
                <span>Shift: <strong>{inTime}</strong> to <strong>{outTime}</strong></span>
                <span style={{ fontWeight: 800, color: '#0284c7' }}>
                  {(() => {
                    const [inH, inM] = inTime.split(':').map(Number);
                    const [outH, outM] = outTime.split(':').map(Number);
                    let mins = (outH * 60 + outM) - (inH * 60 + inM);
                    if (mins < 0) mins += 24 * 60;
                    const hrs = Math.floor(mins / 60);
                    const remM = mins % 60;
                    return `⏱️ ${hrs}h ${remM}m`;
                  })()}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                Punch Time *
              </label>
              <input
                type="time"
                className="form-input"
                value={singleTime}
                onChange={e => setSingleTime(e.target.value)}
                required
                style={{ fontSize: '13px', fontWeight: 700 }}
              />
            </div>
          )}

          {/* Supervisor Reason/Note */}
          <div style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
              Remarks / Reason (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Manual entry / Custom date punch"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ fontSize: '12px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedEmpId}
              style={{ fontWeight: 700 }}
            >
              {submitting ? '⏳ Recording...' : 'Submit Attendance Punch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualPunchModal;
