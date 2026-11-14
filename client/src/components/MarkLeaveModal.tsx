import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, Palmtree } from 'lucide-react';
import api from '../api/client';
import { SearchableEmployeeSelect, EmployeeOption } from './SearchableEmployeeSelect';

interface MarkLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  employees: EmployeeOption[];
  preSelectedEmpId?: string | number | null;
  defaultDate?: string;
}

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual Leave (CL)', desc: 'Standard casual off' },
  { value: 'sick', label: 'Sick / Medical (SL)', desc: 'Health or medical recovery' },
  { value: 'earned', label: 'Earned Leave (EL)', desc: 'Pre-planned paid privilege' },
  { value: 'unpaid', label: 'Unpaid Leave (LWP)', desc: 'Leave without pay / deduction' },
  { value: 'other', label: 'Other / Emergency', desc: 'Special or domestic reason' },
];

const QUICK_REASONS = [
  'Personal / Domestic Work',
  'Fever / Health Checkup',
  'Family Emergency',
  'Out of Town / Village',
  'Prior Approved Leave'
];

export const MarkLeaveModal: React.FC<MarkLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employees,
  preSelectedEmpId = null,
  defaultDate,
}) => {
  const todayStr = defaultDate || new Date().toISOString().split('T')[0];

  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedEmp, setSelectedEmp] = useState<EmployeeOption | null>(null);
  const [leaveType, setLeaveType] = useState<string>('casual');
  const [leaveDate, setLeaveDate] = useState<string>(todayStr);
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSubmitting(false);
      setLeaveDate(defaultDate || new Date().toISOString().split('T')[0]);
      setIsHalfDay(false);
      setReason('');
      setLeaveType('casual');

      if (preSelectedEmpId) {
        setSelectedEmpId(String(preSelectedEmpId));
        const found = employees.find(e => String(e.id) === String(preSelectedEmpId));
        setSelectedEmp(found || null);
      } else {
        setSelectedEmpId('');
        setSelectedEmp(null);
      }
    }
  }, [isOpen, preSelectedEmpId, defaultDate, employees]);

  if (!isOpen) return null;

  const totalDays = isHalfDay ? 0.5 : 1.0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId && !selectedEmp) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!leaveDate) {
      setErrorMsg('Please select the leave date.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        emp_id: selectedEmp?.id || selectedEmpId,
        emp_code: selectedEmp?.emp_code,
        leave_type: leaveType,
        date: leaveDate,
        from_date: leaveDate,
        to_date: leaveDate,
        is_half_day: isHalfDay,
        reason: reason.trim() || undefined
      };

      const res = await api.post('/attendance/leave', payload);
      onSuccess(res.data?.message || `Leave successfully recorded for ${selectedEmp?.name || 'employee'}`);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit leave:', err);
      setErrorMsg(err.response?.data?.message || 'Server error while submitting leave');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92vh'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Palmtree size={20} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Mark Single Day Leave
              </h2>
              <p style={{ fontSize: '12px', margin: 0, opacity: 0.9 }}>
                Shift Supervisor Single-Day Leave Record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Employee Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
              Select Active Employee *
            </label>
            <SearchableEmployeeSelect
              employees={employees}
              value={selectedEmpId}
              onChange={(id, emp) => {
                setSelectedEmpId(id);
                setSelectedEmp(emp || null);
              }}
              placeholder="Type Emp Code (e.g. 8007) or Name..."
              requireQuery={false}
              required
            />
          </div>

          {/* Leave Type Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
              Leave Type *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {LEAVE_TYPES.map(t => {
                const isSelected = leaveType === t.value;
                return (
                  <div
                    key={t.value}
                    onClick={() => setLeaveType(t.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: isSelected ? '#f0f9ff' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#0369a1' : '#334155' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      {t.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date & Full/Half Day Selection */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Leave Date *
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={leaveDate}
                  onChange={e => setLeaveDate(e.target.value)}
                  required
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Duration
                </label>
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setIsHalfDay(false)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: !isHalfDay ? '#0284c7' : 'transparent',
                      color: !isHalfDay ? '#ffffff' : '#64748b'
                    }}
                  >
                    1 Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHalfDay(true)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isHalfDay ? '#0284c7' : 'transparent',
                      color: isHalfDay ? '#ffffff' : '#64748b'
                    }}
                  >
                    0.5 Day
                  </button>
                </div>
              </div>
            </div>

            {/* Total Duration Note */}
            <div style={{
              marginTop: '10px',
              padding: '6px 10px',
              background: '#e0f2fe',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px'
            }}>
              <span style={{ color: '#0369a1', fontWeight: 600 }}>Selected Shift Date:</span>
              <span style={{ color: '#0284c7', fontWeight: 800 }}>
                {leaveDate} ({totalDays} day)
              </span>
            </div>
          </div>

          {/* Reason & Remarks */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>
              Reason / Remarks (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Approved medical rest, family function..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ fontSize: '13px', marginBottom: '8px' }}
            />

            {/* Quick Reason Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUICK_REASONS.map((qr, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setReason(qr)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  + {qr}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ flex: 1, padding: '10px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (!selectedEmpId && !selectedEmp)}
              style={{
                flex: 2,
                padding: '10px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Palmtree size={16} />
              {submitting ? 'Granting Leave...' : `Grant ${totalDays} Day Leave`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarkLeaveModal;
