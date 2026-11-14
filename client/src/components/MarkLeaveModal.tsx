import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, AlertCircle, Palmtree, Printer, Download, CheckCircle2, FileText, Clock, UserCheck } from 'lucide-react';
import api from '../api/client';
import { SearchableEmployeeSelect, EmployeeOption } from './SearchableEmployeeSelect';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface MarkLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string, slipMeta?: { emp_id: string | number; date: string }) => void;
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
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

  // Live Dossier & Print State
  const [slipData, setSlipData] = useState<any>(null);
  const [loadingSlip, setLoadingSlip] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSubmitting(false);
      setLeaveDate(defaultDate || new Date().toISOString().split('T')[0]);
      setIsHalfDay(false);
      setReason('');
      setLeaveType('casual');

      if (preSelectedEmpId) {
        const found = employees.find(e => 
          String(e.emp_code).toLowerCase() === String(preSelectedEmpId).toLowerCase() || 
          String(e.id) === String(preSelectedEmpId)
        );
        if (found) {
          setSelectedEmpId(String(found.id));
          setSelectedEmp(found);
        } else {
          setSelectedEmpId(String(preSelectedEmpId));
          // Pre-fetch employee details by code/id from backend
          api.get(`/employees/${preSelectedEmpId}`).then(res => {
            if (res.data?.success && res.data?.data) {
              setSelectedEmpId(String(res.data.data.id));
              setSelectedEmp(res.data.data);
            }
          }).catch(console.error);
        }
      } else {
        setSelectedEmpId('');
        setSelectedEmp(null);
        setSlipData(null);
      }
    }
  }, [isOpen, preSelectedEmpId, defaultDate, employees]);

  // Fetch / Refresh slip preview data whenever employee or leave specifics change
  useEffect(() => {
    const activeId = selectedEmp?.emp_code || selectedEmp?.id || selectedEmpId;
    if (isOpen && activeId) {
      fetchSlipPreview(activeId);
    } else {
      setSlipData(null);
    }
  }, [isOpen, selectedEmpId, selectedEmp, leaveDate, leaveType, isHalfDay, reason]);

  const fetchSlipPreview = async (id: string | number) => {
    try {
      setLoadingSlip(true);
      const totalDays = isHalfDay ? 0.5 : 1.0;
      const res = await api.get(
        `/attendance/leave-slip/${id}?date=${leaveDate}&leave_type=${leaveType}&total_days=${totalDays}&reason=${encodeURIComponent(reason)}`
      );
      if (res.data?.success) {
        setSlipData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load slip preview:', err);
    } finally {
      setLoadingSlip(false);
    }
  };

  if (!isOpen) return null;

  const totalDays = isHalfDay ? 0.5 : 1.0;

  // Print slip for Section Head signature
  const handlePrint = () => {
    window.print();
  };

  // Download PDF copy
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    try {
      setDownloading(true);
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const filename = `Leave_Application_${selectedEmp?.emp_code || 'EMP'}_${leaveDate}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Confirm leave AFTER Section Head has signed
  const handleConfirmAndMarkLeave = async () => {
    if (!selectedEmpId && !selectedEmp) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!leaveDate) {
      setErrorMsg('Please select the leave date.');
      return;
    }

    const confirmSign = window.confirm(
      `Has the Section Head reviewed and physically signed the leave application slip for ${selectedEmp?.name || 'this employee'}?\n\nClick OK to confirm Section Head signature and officially record the leave in the attendance system.`
    );
    if (!confirmSign) return;

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
      onSuccess(res.data?.message || `Leave officially recorded for ${selectedEmp?.name || 'employee'}`, {
        emp_id: selectedEmp?.id || selectedEmpId,
        date: leaveDate
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to submit leave:', err);
      setErrorMsg(err.response?.data?.message || 'Server error while submitting leave');
    } finally {
      setSubmitting(false);
    }
  };

  const emp = slipData?.employee || selectedEmp || {};
  const past6Months = slipData?.past_6_months || [];
  const lastMonth = slipData?.last_month || null;
  const curMonth = slipData?.current_month || null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1050, padding: '16px'
    }}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #leave-slip-print-container, #leave-slip-print-container * {
            visibility: visible;
          }
          #leave-slip-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '94vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header Bar */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 22px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff', borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Palmtree size={18} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Leave Application & Section Head Sanction Dossier
              </h2>
              <p style={{ fontSize: '11px', margin: 0, opacity: 0.9 }}>
                Step 1: Print application for Section Head signature &nbsp;•&nbsp; Step 2: Mark leave once signed
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#ffffff', padding: '6px',
              cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div className="no-print" style={{
              padding: '12px 14px', borderRadius: '8px', background: '#fef2f2',
              border: '1px solid #fecaca', color: '#dc2626', fontSize: '12px',
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Controls (Non-Printable) */}
          <div className="no-print" style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '16px', marginBottom: '18px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '5px' }}>
                  Select Active Employee *
                </label>
                <SearchableEmployeeSelect
                  employees={employees}
                  value={selectedEmpId}
                  onChange={(id, e) => {
                    setSelectedEmpId(id);
                    setSelectedEmp(e || null);
                  }}
                  placeholder="Type Emp Code (e.g. 8007) or Name..."
                  requireQuery={false}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '5px' }}>
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '5px' }}>
                    Duration
                  </label>
                  <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setIsHalfDay(false)}
                      style={{
                        flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                        border: 'none', cursor: 'pointer',
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
                        flex: 1, padding: '6px 4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px',
                        border: 'none', cursor: 'pointer',
                        background: isHalfDay ? '#0284c7' : 'transparent',
                        color: isHalfDay ? '#ffffff' : '#64748b'
                      }}
                    >
                      0.5 Day
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '5px' }}>
                  Leave Type
                </label>
                <select
                  className="form-input"
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value)}
                  style={{ fontSize: '13px' }}
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '5px' }}>
                  Reason / Purpose of Leave
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Urgent domestic work, medical rest..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Workflow Guide Strip */}
          <div className="no-print" style={{
            background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', fontSize: '12px', color: '#0369a1'
          }}>
            <div>
              <strong>Official Procedure:</strong> Print this template sheet &rarr; Employee/Supervisor takes it to <strong>Section Head</strong> for physical signature &rarr; Once signed, click <strong>"Confirm & Mark Leave"</strong>.
            </div>
            <button
              onClick={handlePrint}
              disabled={!selectedEmpId && !selectedEmp}
              style={{
                background: '#0284c7', color: '#ffffff', border: 'none', padding: '5px 12px',
                borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px'
              }}
            >
              <Printer size={13} /> Print Application Now
            </button>
          </div>

          {/* Printable Official Application & Sanction Sheet Container */}
          {(!selectedEmpId && !selectedEmp) ? (
            <div className="no-print" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
              Select an employee above to preview and print their official Leave Application & 6-Month Presence Dossier.
            </div>
          ) : (
            <div id="leave-slip-print-container" ref={printRef} style={{
              background: '#ffffff', color: '#0f172a', padding: '16px',
              border: '1px solid #cbd5e1', borderRadius: '8px', fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {/* Slip Header */}
              <div style={{
                borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#0369a1', textTransform: 'uppercase' }}>
                    ATTENDPRO WORKFORCE MANAGEMENT SYSTEM
                  </div>
                  <h1 style={{ fontSize: '19px', fontWeight: 900, margin: '3px 0 2px 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
                    LEAVE APPLICATION & SANCTION SLIP
                  </h1>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Official Section Head Sanction & Historical Attendance Audit Dossier
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: '11px', color: '#334155' }}>
                  <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '12px' }}>
                    {slipData?.application_no || `LV-${leaveDate.replace(/-/g, '')}-${emp.emp_code || 'EMP'}`}
                  </div>
                  <div>Application Date: <strong>{leaveDate}</strong></div>
                  <div>Shift Supervisor Desk: <strong>Verified</strong></div>
                </div>
              </div>

              {/* Section 1: Employee Particulars */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
                padding: '9px 12px', marginBottom: '10px', fontSize: '11px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#1e293b', marginBottom: '6px', textTransform: 'uppercase' }}>
                  1. Employee Particulars
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px' }}>
                  <div><span style={{ color: '#64748b' }}>Employee Name:</span> <strong>{emp.name}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Employee Code:</span> <strong style={{ color: '#0284c7' }}>{emp.emp_code}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Department / Section:</span> <strong>{emp.department_name || emp.dept_name || 'Staff'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Designation / Role:</span> <strong>{emp.job_role || emp.posting_name || 'Staff Member'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Joining Date:</span> <strong>{emp.date_of_joining ? String(emp.date_of_joining).slice(0, 10) : '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Contact Phone:</span> <strong>{emp.phone || '—'}</strong></div>
                </div>
              </div>

              {/* Section 2: Applied Leave Particulars */}
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px',
                padding: '9px 12px', marginBottom: '10px', fontSize: '11px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#0369a1', marginBottom: '6px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Leave Request Details</span>
                  <span style={{
                    background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                    padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800
                  }}>
                    AWAITING SECTION HEAD SIGNATURE
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 12px', marginBottom: '5px' }}>
                  <div><span style={{ color: '#64748b' }}>Leave Date:</span> <strong>{leaveDate}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Leave Category:</span> <strong style={{ textTransform: 'uppercase', color: '#0369a1' }}>{leaveType}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Duration:</span> <strong>{totalDays} Day ({isHalfDay ? 'Half Day' : 'Full Day'})</strong></div>
                  <div><span style={{ color: '#64748b' }}>Shift:</span> <strong>Standard Shift</strong></div>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '4px' }}>
                  <span style={{ color: '#64748b' }}>Reason / Purpose:</span> <strong>{reason.trim() || 'Personal / Domestic Work'}</strong>
                </div>
              </div>

              {/* Section 3: Attendance & Leave Audit Record (The core requirement) */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase',
                  marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px'
                }}>
                  3. Historical Attendance & Leave Audit Dossier
                </div>

                {/* Sub-section 3A: Last Month & Current Month Summary Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  {/* Last Month Box */}
                  <div style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '7px 10px', fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📊 Last Month Audit ({lastMonth ? `${MONTH_NAMES[lastMonth.month - 1]} ${lastMonth.year}` : 'Previous Period'})</span>
                      {lastMonth && <span style={{ color: '#16a34a', fontWeight: 800 }}>{lastMonth.presence_rate}% Presence</span>}
                    </div>
                    {lastMonth ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '10px' }}>
                        <div>Present: <strong>{lastMonth.present_days}d</strong></div>
                        <div>Leaves Taken: <strong>{lastMonth.leaves_taken}d</strong></div>
                        <div>Absents: <strong style={{ color: lastMonth.absent_days > 0 ? '#dc2626' : '#16a34a' }}>{lastMonth.absent_days}d</strong></div>
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Historical month data loaded.</div>
                    )}
                  </div>

                  {/* Current Month Box */}
                  <div style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '7px 10px', fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>
                      ⚡ Current Month In-Progress Status
                    </div>
                    {curMonth ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '10px' }}>
                        <div>Present So Far: <strong>{curMonth.present_days}d</strong></div>
                        <div>Leaves So Far: <strong>{curMonth.leave_days}d</strong></div>
                        <div>Absents: <strong>{curMonth.absent_days}d</strong></div>
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>In-progress data current.</div>
                    )}
                  </div>
                </div>

                {/* Sub-section 3B: Past 6 Months Presence Trend Table */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                        <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 700 }}>Month & Year (Last 6 Months)</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700 }}>Total Days</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700, color: '#16a34a' }}>🟢 Present Days</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700, color: '#0284c7' }}>🌴 Leaves Taken</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700, color: '#dc2626' }}>🔴 Absent Days</th>
                        <th style={{ padding: '5px 8px', fontWeight: 700 }}>Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past6Months.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '10px', color: '#94a3b8' }}>
                            {loadingSlip ? 'Fetching 6-month historical attendance records...' : 'No prior 6-month records found.'}
                          </td>
                        </tr>
                      ) : (
                        past6Months.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                            <td style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>
                              {MONTH_NAMES[row.month - 1]} {row.year}
                            </td>
                            <td style={{ padding: '4px 8px' }}>{row.working_days}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 700, color: '#15803d' }}>{row.present_days}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0369a1' }}>{row.leave_days}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 600, color: row.absent_days > 0 ? '#dc2626' : '#64748b' }}>
                              {row.absent_days}
                            </td>
                            <td style={{ padding: '4px 8px', fontWeight: 700 }}>
                              {row.rate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Signatures & Section Head Official Sanction Box */}
              <div style={{
                marginTop: '12px', borderTop: '2px solid #0f172a', paddingTop: '10px'
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px'
                }}>
                  4. Signatures & Section Head Official Sanction
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '10px' }}>
                  {/* Applicant Signature */}
                  <div style={{
                    border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', height: '115px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#475569' }}>Applicant / Employee</div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', textAlign: 'center' }}>
                      <div>Signature of Employee</div>
                      <div style={{ color: '#94a3b8', fontSize: '9px' }}>Date: ____/____/2026</div>
                    </div>
                  </div>

                  {/* Shift Supervisor Verification */}
                  <div style={{
                    border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', height: '115px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#475569' }}>Shift Supervisor Verification</div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', textAlign: 'center' }}>
                      <div>Shift Supervisor Desk</div>
                      <div style={{ color: '#94a3b8', fontSize: '9px' }}>Verified & Entered on Shift Desk</div>
                    </div>
                  </div>

                  {/* Section Head Authorization Box (With Decision & Stamp Area) */}
                  <div style={{
                    border: '2px solid #0369a1', borderRadius: '6px', padding: '8px 10px', height: '115px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px',
                    background: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', fontSize: '10px' }}>
                        SECTION HEAD SANCTION
                      </span>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '9px', fontWeight: 700 }}>
                        <span style={{ border: '1px solid #16a34a', padding: '1px 5px', borderRadius: '3px', color: '#16a34a', background: '#f0fdf4' }}>
                          [ &nbsp; ] APPROVED
                        </span>
                        <span style={{ border: '1px solid #dc2626', padding: '1px 5px', borderRadius: '3px', color: '#dc2626', background: '#fef2f2' }}>
                          [ &nbsp; ] DISAPPROVED
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', margin: '2px 0' }}>
                      If Disapproved, remarks: ____________________________________
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '3px' }}>
                      <div style={{ fontSize: '9px', color: '#334155' }}>
                        <div>Section Head Signature: ____________</div>
                        <div style={{ marginTop: '2px' }}>Name: <strong>________________________</strong></div>
                        <div style={{ marginTop: '1px' }}>Dept: <strong>{emp.department_name || emp.dept_name || 'Department'}</strong></div>
                      </div>

                      {/* Official Stamp Box */}
                      <div style={{
                        width: '74px', height: '36px', border: '1px dashed #94a3b8', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px',
                        color: '#64748b', textAlign: 'center', lineHeight: 1.1, background: '#ffffff'
                      }}>
                        SECTION HEAD<br/>STAMP / SEAL
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', marginTop: '8px' }}>
                  This leave application is generated via AttendPro ERP. Physical signed copy to be retained by Section Head.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls (Non-Printable) */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!selectedEmpId && !selectedEmp}
              className="btn btn-secondary"
              style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Printer size={15} /> 1. Print Application for Section Head
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!selectedEmpId && !selectedEmp || downloading}
              className="btn btn-secondary"
              style={{ padding: '9px 14px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Download size={15} /> {downloading ? 'Saving...' : 'Download PDF'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '9px 16px', fontSize: '12px' }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmAndMarkLeave}
              disabled={submitting || (!selectedEmpId && !selectedEmp)}
              className="btn btn-primary"
              style={{
                padding: '9px 18px', fontSize: '13px', fontWeight: 800,
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 2px 8px rgba(22,163,74,0.3)'
              }}
              title="Click here ONLY AFTER Section Head has physically signed the printed sheet"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Confirming...' : '2. Section Head Signed: Confirm & Mark Leave'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkLeaveModal;
