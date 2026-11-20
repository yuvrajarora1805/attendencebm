import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, AlertTriangle, ShieldCheck, DoorOpen, Briefcase, HeartPulse } from 'lucide-react';
import api from '../api/client';
import SearchableEmployeeSelect, { EmployeeOption } from './SearchableEmployeeSelect';

export interface ApplyGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultEmpId?: string | number | null;
  defaultDate?: string;
}

export const ApplyGatePassModal: React.FC<ApplyGatePassModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultEmpId,
  defaultDate
}) => {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [date, setDate] = useState<string>(
    defaultDate || new Date().toLocaleDateString('en-CA')
  );
  const [passType, setPassType] = useState<'personal' | 'official' | 'emergency'>('personal');
  const [reason, setReason] = useState<string>('');
  const [expectedOutTime, setExpectedOutTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [expectedInTime, setExpectedInTime] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 hours default
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [isDeductible, setIsDeductible] = useState<boolean>(true);
  const [outNow, setOutNow] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.get('/employees?status=active')
        .then(res => {
          if (res.data?.data) {
            setEmployees(res.data.data);
            if (defaultEmpId) {
              const matched = res.data.data.find(
                (e: any) => String(e.id) === String(defaultEmpId) || e.emp_code?.toUpperCase() === String(defaultEmpId).toUpperCase()
              );
              if (matched) setSelectedEmpId(String(matched.id));
            }
          }
        })
        .catch(err => console.error('Failed to load employees for gate pass', err));

      if (defaultDate) setDate(defaultDate);
      setError(null);
    }
  }, [isOpen, defaultDate, defaultEmpId]);

  // Adjust deductible automatically when pass type changes
  const handlePassTypeChange = (type: 'personal' | 'official' | 'emergency') => {
    setPassType(type);
    if (type === 'official') {
      setIsDeductible(false);
    } else {
      setIsDeductible(true);
    }
  };

  if (!isOpen) return null;

  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId));

  const QUICK_REASONS = passType === 'official' ? [
    'Client visit / Meeting',
    'Bank official transaction',
    'Material / Spare purchase',
    'Site inspection / Maintenance',
    'Vendor coordination'
  ] : [
    'Doctor / Clinic appointment',
    'Personal bank work',
    'Urgent domestic family work',
    'Not feeling well / Medical',
    'Personal government office work'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) {
      setError('Please select an active employee');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter reason/purpose for the gate pass');
      return;
    }
    if (!expectedOutTime) {
      setError('Expected Out Time is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        emp_id: selectedEmp.id,
        emp_code: selectedEmp.emp_code,
        date,
        pass_type: passType,
        reason: reason.trim(),
        expected_out_time: expectedOutTime,
        expected_in_time: expectedInTime || null,
        is_deductible: isDeductible,
        out_now: outNow,
        notes: notes.trim() || undefined
      };

      const res = await api.post('/gate-pass', payload);
      alert(`✅ Gate Pass Issued: ${res.data.data?.pass_number || 'Success'} for ${selectedEmp.name} (${selectedEmp.emp_code})`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to issue gate pass:', err);
      setError(err.response?.data?.message || 'Failed to issue gate pass');
    } finally {
      setSubmitting(false);
    }
  };

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
          maxWidth: '540px',
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
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🎫</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                Issue Gate Pass / Out Slip
              </h3>
            </div>
            <div style={{ fontSize: '11px', color: '#e0f2fe', marginTop: '2px' }}>
              Authorize staff gate exit with shift time deduction tracking
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
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

          {/* Pass Type Selector Tabs */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
              Select Pass Type *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handlePassTypeChange('personal')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: passType === 'personal' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: passType === 'personal' ? '#f0f9ff' : '#ffffff',
                  color: passType === 'personal' ? '#0369a1' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <DoorOpen size={14} /> Personal
              </button>

              <button
                type="button"
                onClick={() => handlePassTypeChange('official')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: passType === 'official' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: passType === 'official' ? '#f0fdf4' : '#ffffff',
                  color: passType === 'official' ? '#15803d' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Briefcase size={14} /> Official (Paid)
              </button>

              <button
                type="button"
                onClick={() => handlePassTypeChange('emergency')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: passType === 'emergency' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                  background: passType === 'emergency' ? '#fef2f2' : '#ffffff',
                  color: passType === 'emergency' ? '#b91c1c' : '#475569',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <HeartPulse size={14} /> Emergency
              </button>
            </div>
          </div>

          {/* Employee & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                Select Employee *
              </label>
              <SearchableEmployeeSelect
                employees={employees}
                value={selectedEmpId}
                onChange={setSelectedEmpId}
                placeholder="Search code or name..."
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                Pass Date *
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
          </div>

          {/* Timings */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginBottom: '3px' }}>
                  🚪 Expected Out Time *
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={expectedOutTime}
                  onChange={e => setExpectedOutTime(e.target.value)}
                  required
                  style={{ fontSize: '13px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', marginBottom: '3px' }}>
                  🟢 Expected Return Time
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={expectedInTime}
                  onChange={e => setExpectedInTime(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Deduction Rule Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isDeductible}
                  onChange={e => setIsDeductible(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>✂️ Cut time from working shift hours ({isDeductible ? 'Yes - Personal' : 'No - Official/Paid'})</span>
              </label>

              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#0369a1' }}>
                <input
                  type="checkbox"
                  checked={outNow}
                  onChange={e => setOutNow(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>🚪 Mark OUT Now</span>
              </label>
            </div>
          </div>

          {/* Reason / Purpose */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
              Purpose / Reason *
            </label>
            <input
              type="text"
              className="form-input"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Doctor appointment, bank work, client meeting..."
              required
              style={{ fontSize: '13px', marginBottom: '6px' }}
            />
            {/* Quick chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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

          {/* Supervisor / Gate Notes */}
          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label" style={{ fontSize: '11px' }}>Supervisor / Gate Remarks (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Approved by Plant Manager"
              style={{ fontSize: '12px' }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
              disabled={submitting || !selectedEmpId || !reason.trim()}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? '⏳ Issuing...' : '🎫 Issue Gate Pass'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyGatePassModal;
