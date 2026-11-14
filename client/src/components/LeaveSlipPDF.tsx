import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, X, Palmtree, User, Calendar, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import api from '../api/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface LeaveSlipPDFProps {
  isOpen: boolean;
  onClose: () => void;
  data?: any | null;
  empId?: string | number | null;
  leaveDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const LeaveSlipPDF: React.FC<LeaveSlipPDFProps> = ({
  isOpen,
  onClose,
  data: initialData = null,
  empId = null,
  leaveDate = '',
}) => {
  const [slipData, setSlipData] = useState<any>(initialData);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setSlipData(initialData);
      } else if (empId) {
        fetchSlipData();
      }
    }
  }, [isOpen, initialData, empId, leaveDate]);

  const fetchSlipData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get(`/attendance/leave-slip/${empId}?date=${leaveDate || ''}`);
      if (res.data?.success) {
        setSlipData(res.data.data);
      } else {
        setErrorMsg('Failed to load leave slip information.');
      }
    } catch (err: any) {
      console.error('Error fetching slip data:', err);
      setErrorMsg(err.response?.data?.message || 'Server error loading leave slip.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

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
      const filename = `Leave_Slip_${slipData?.employee?.emp_code || 'EMP'}_${slipData?.leave?.date || 'LEAVE'}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const emp = slipData?.employee || {};
  const leave = slipData?.leave || {};
  const lastMonth = slipData?.last_month || null;
  const curMonth = slipData?.current_month || null;
  const past6Months = slipData?.past_6_months || [];

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: '16px'
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
        maxWidth: '820px',
        maxHeight: '94vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Control Bar (Non-printable) */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff', borderRadius: '16px 16px 0 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} />
            <span style={{ fontWeight: 700, fontSize: '15px' }}>
              Official Leave Application & Sanction Slip
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              disabled={loading || !slipData}
              className="btn"
              style={{
                background: '#ffffff', color: '#0369a1', fontWeight: 700, padding: '6px 14px',
                fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Printer size={14} /> Print Slip
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={loading || !slipData || downloading}
              className="btn"
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#ffffff', fontWeight: 700,
                padding: '6px 14px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Download size={14} /> {downloading ? 'Saving...' : 'Download PDF'}
            </button>
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
        </div>

        {/* Modal Content / Printable Document Area */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading official leave slip & attendance dossier...</div>
            </div>
          ) : errorMsg ? (
            <div style={{
              padding: '16px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <AlertCircle size={16} /> {errorMsg}
            </div>
          ) : slipData ? (
            <div id="leave-slip-print-container" ref={printRef} style={{
              background: '#ffffff', color: '#0f172a', padding: '16px',
              border: '1px solid #cbd5e1', borderRadius: '8px', fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {/* Slip Header */}
              <div style={{
                borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '14px',
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
                    {slipData.application_no}
                  </div>
                  <div>Issued: {new Date(slipData.generated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div>Supervisor: <strong>{slipData.generated_by || 'Supervisor'}</strong></div>
                </div>
              </div>

              {/* Section 1: Employee Particulars */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
                padding: '10px 12px', marginBottom: '12px', fontSize: '11px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#1e293b', marginBottom: '6px', textTransform: 'uppercase' }}>
                  1. Employee Particulars
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px' }}>
                  <div><span style={{ color: '#64748b' }}>Employee Name:</span> <strong>{emp.name}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Employee Code:</span> <strong style={{ color: '#0284c7' }}>{emp.emp_code}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Department / Section:</span> <strong>{emp.department_name || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Designation / Role:</span> <strong>{emp.job_role || emp.posting_name || 'Staff'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Joined Date:</span> <strong>{emp.date_of_joining ? emp.date_of_joining.slice(0, 10) : '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Contact Phone:</span> <strong>{emp.phone || '—'}</strong></div>
                </div>
              </div>

              {/* Section 2: Sanctioned Leave Details */}
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px',
                padding: '10px 12px', marginBottom: '12px', fontSize: '11px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '11px', color: '#0369a1', marginBottom: '6px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                  <span>2. Leave Sanction Details</span>
                  <span style={{
                    background: '#0284c7', color: '#ffffff', padding: '1px 8px', borderRadius: '4px',
                    fontSize: '10px', fontWeight: 800
                  }}>
                    STATUS: APPROVED & SANCTIONED
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 12px', marginBottom: '6px' }}>
                  <div><span style={{ color: '#64748b' }}>Leave Date:</span> <strong>{leave.date}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Leave Type:</span> <strong style={{ textTransform: 'uppercase', color: '#0369a1' }}>{leave.leave_type}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Duration:</span> <strong>{leave.total_days} Day{leave.total_days > 1 ? 's' : ''}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Sanction Date:</span> <strong>{new Date(leave.approved_at || slipData.generated_at).toLocaleDateString()}</strong></div>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '4px' }}>
                  <span style={{ color: '#64748b' }}>Reason / Purpose of Leave:</span> <strong>{leave.reason || 'Personal / Domestic Off'}</strong>
                </div>
              </div>

              {/* Section 3: Attendance & Leave Audit Record (User's specific core requirement) */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase',
                  marginBottom: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px'
                }}>
                  3. Historical Attendance & Leave Audit Dossier
                </div>

                {/* Sub-section 3A: Last Month & Current Month Summary Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  {/* Last Month Box */}
                  <div style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
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
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>No previous payroll period found.</div>
                    )}
                  </div>

                  {/* Current Month Box */}
                  <div style={{
                    background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '11px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
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

                {/* Sub-section 3B: Past 6 Months Trend Table */}
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
                          <td colSpan={6} style={{ padding: '12px', color: '#94a3b8' }}>
                            No prior 6-month historical slips recorded for this employee.
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

              {/* Section 4: Signatures & Section Head Authorization (Crucial User Requirement) */}
              <div style={{
                marginTop: '16px', borderTop: '2px solid #0f172a', paddingTop: '10px'
              }}>
                <div style={{
                  fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginBottom: '8px'
                }}>
                  4. Signatures & Section Head Official Sanction
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '10px' }}>
                  {/* Applicant Signature */}
                  <div style={{
                    border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', height: '110px',
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
                    border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', height: '110px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px'
                  }}>
                    <div style={{ fontWeight: 700, color: '#475569' }}>Shift Supervisor Verification</div>
                    <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', textAlign: 'center' }}>
                      <div>{slipData.generated_by || 'Shift Supervisor'}</div>
                      <div style={{ color: '#94a3b8', fontSize: '9px' }}>Verified & Entered on Shift Desk</div>
                    </div>
                  </div>

                  {/* Section Head Authorization Box (Highlighted with Decision & Stamp Area) */}
                  <div style={{
                    border: '2px solid #0369a1', borderRadius: '6px', padding: '8px 10px', height: '110px',
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
                        <div style={{ marginTop: '2px' }}>Name / Dept: <strong>{emp.department_name || 'Department'}</strong></div>
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

                <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', marginTop: '10px' }}>
                  This leave slip is officially generated by AttendPro ERP. Physical signed copy to be retained by Section Incharge.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default LeaveSlipPDF;

