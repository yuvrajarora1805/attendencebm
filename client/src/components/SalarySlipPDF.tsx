import React from 'react';
import { Printer, X } from 'lucide-react';

interface SalarySlipPDFProps {
  isOpen: boolean;
  onClose: () => void;
  data: any | null;
}

export const SalarySlipPDF: React.FC<SalarySlipPDFProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  // Helper to extract cycle splits
  const getCycleSplits = (row: any): string[] => {
    try {
      if (row.snapshot_json) {
        const snap = typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json;
        if (Array.isArray(snap?.cycle_deductions) && snap.cycle_deductions.length > 0) {
          return snap.cycle_deductions;
        }
      }
    } catch (e) {}

    if (row.deduction_remarks && row.deduction_remarks.includes('Cycle')) {
      const match = row.deduction_remarks.match(/\((Cycle [^)]+)\)/);
      if (match && match[1]) {
        return match[1].split('•').map((s: string) => s.trim());
      }
      const parts = row.deduction_remarks.split('•').map((s: string) => s.trim()).filter((s: string) => s.includes('Cycle'));
      if (parts.length > 0) return parts;
    }

    return [];
  };

  const cycleSplits = getCycleSplits(data);
  const basicSalary = Number(data.basic_salary) || 0;
  const leavesAmount = Number(data.leaves_amount) || 0;
  const advanceDed = Number(data.advance_deduction) || 0;
  const otherDed = Number(data.other_deduction) || 0;
  const otherInc = Number(data.other_incentives) || 0;
  const grossEarnings = basicSalary + otherInc;
  const totalDeductions = leavesAmount + advanceDed + otherDed;
  const netPayable = Number(data.gross_amount) || (grossEarnings - totalDeductions);
  const advanceCf = Number(data.advance_cf) || 0;
  const perDayRate = Number(data.salary_per_day) || (basicSalary > 0 ? (basicSalary / 30) : 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', background: '#fff', color: '#111827', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#111827', letterSpacing: '-0.02em' }}>PAYSLIP</h2>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Period: <strong>{data.month ? `${data.month}/${data.year}` : (data.period_name || 'Current Period')}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handlePrint} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px', color: '#374151' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Slip Body */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '16px', fontSize: '12px', background: '#ffffff' }}>
          {/* Employee Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: '14px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
            <div><span style={{ color: '#64748b' }}>Employee:</span> <strong>{data.emp_name}</strong> ({data.emp_code})</div>
            <div><span style={{ color: '#64748b' }}>Department:</span> <strong>{data.department || data.department_name || 'N/A'}</strong></div>
            <div><span style={{ color: '#64748b' }}>Bank:</span> <strong>{data.bank_name || 'N/A'}</strong></div>
            <div><span style={{ color: '#64748b' }}>Account:</span> <strong>{data.bank_account || 'N/A'}</strong></div>
          </div>

          {/* Earnings & Deductions Comparison Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, color: '#334155' }}>Earnings</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: '#334155', width: '110px' }}>Amount (Rs.)</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', borderLeft: '1px solid #e2e8f0', fontWeight: 700, color: '#334155' }}>Deductions</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700, color: '#334155', width: '110px' }}>Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Basic Salary vs Leaves Deduction */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600 }}>Basic Salary</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Per day rate: ₹{perDayRate.toFixed(2)}</div>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 10px', verticalAlign: 'top', fontWeight: 600 }}>
                  {basicSalary.toFixed(2)}
                </td>
                <td style={{ padding: '8px 10px', borderLeft: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600 }}>Leaves Deduction ({Number(data.final_leaves || 0).toFixed(1)}d)</div>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>
                    {Number(data.final_leaves || 0) > 0 ? `${Number(data.final_leaves).toFixed(1)} unexcused absence days charged` : 'Zero penalty'}
                  </div>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 10px', verticalAlign: 'top', fontWeight: 600, color: '#dc2626' }}>
                  {leavesAmount.toFixed(2)}
                </td>
              </tr>

              {/* Row 2: Incentives vs Itemized Advance Deductions */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600 }}>Incentives / Bonus</div>
                  {data.incentive_remarks && (
                    <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px' }}>{data.incentive_remarks}</div>
                  )}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 10px', verticalAlign: 'top', fontWeight: 600 }}>
                  {otherInc.toFixed(2)}
                </td>
                <td style={{ padding: '8px 10px', borderLeft: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>
                    Advance Deductions {cycleSplits.length > 1 ? `(${cycleSplits.length} cycles)` : ''}
                  </div>
                  {cycleSplits && cycleSplits.length > 0 ? (
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {cycleSplits.map((item: string, idx: number) => (
                        <div key={idx} style={{ 
                          fontSize: '11px', 
                          background: '#f8fafc', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '4px', 
                          padding: '3px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#1e40af'
                        }}>
                          <span style={{ fontWeight: 700 }}>↳</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : advanceDed > 0 ? (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Monthly payroll recovery cut
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      No advance cuts applied
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 10px', verticalAlign: 'top', fontWeight: 700, color: '#dc2626' }}>
                  {advanceDed.toFixed(2)}
                </td>
              </tr>

              {/* Row 3: Blank vs Other Deductions */}
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', color: '#9ca3af' }}>—</td>
                <td style={{ textAlign: 'right', padding: '8px 10px', color: '#9ca3af' }}>—</td>
                <td style={{ padding: '8px 10px', borderLeft: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600 }}>Other Deductions</div>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#dc2626' }}>
                  {otherDed.toFixed(2)}
                </td>
              </tr>

              {/* Totals Header Row */}
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                <td style={{ padding: '10px' }}>Gross Earnings</td>
                <td style={{ textAlign: 'right', padding: '10px', color: '#047857', fontSize: '13px' }}>
                  {grossEarnings.toFixed(2)}
                </td>
                <td style={{ padding: '10px', borderLeft: '1px solid #e2e8f0' }}>Total Deductions</td>
                <td style={{ textAlign: 'right', padding: '10px', color: '#dc2626', fontSize: '13px' }}>
                  {totalDeductions.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Net Payable Highlight Banner */}
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px', 
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
            border: '1px solid #a7f3d0',
            borderRadius: '6px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: '14px', textTransform: 'uppercase' }}>
                Net Payable Amount:
              </div>
              <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
                Gross Earnings (₹{grossEarnings.toFixed(2)}) − Total Deductions (₹{totalDeductions.toFixed(2)})
              </div>
            </div>
            <div style={{ fontWeight: 800, color: '#047857', fontSize: '20px' }}>
              Rs. {netPayable.toFixed(2)}
            </div>
          </div>

          {/* Itemized Deductions & Advance Ledger Split Breakdown Box */}
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '11px'
          }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 Itemized Deductions & Advance Ledger Split Summary</span>
              <span className="badge" style={{ 
                background: advanceCf > 0 ? '#fef2f2' : '#f0fdf4', 
                color: advanceCf > 0 ? '#dc2626' : '#16a34a',
                border: advanceCf > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px'
              }}>
                Advance C/F (Remaining Debt): Rs. {advanceCf.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>• Absence Leaves Deduction ({Number(data.final_leaves || 0).toFixed(1)} days @ ₹{perDayRate.toFixed(2)}/d):</span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>− Rs. {leavesAmount.toFixed(2)}</span>
              </div>

              {cycleSplits && cycleSplits.length > 0 ? (
                cycleSplits.map((c: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '12px', color: '#1e40af' }}>
                    <span>↳ {c}</span>
                  </div>
                ))
              ) : advanceDed > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>• Advance Payroll Recovery Cut:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>− Rs. {advanceDed.toFixed(2)}</span>
                </div>
              ) : null}

              {otherDed > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>• Other Statutory / Disciplinary Deductions:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>− Rs. {otherDed.toFixed(2)}</span>
                </div>
              )}

              {data.deduction_remarks && (
                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: '10px', color: '#64748b' }}>
                  <strong>Ledger Narration:</strong> {data.deduction_remarks}
                </div>
              )}
            </div>
          </div>

          {/* Footer Stats Strip */}
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
            <span>Worked Days: <strong>{data.worked_days || 26}</strong> / Present: <strong>{data.present_days}</strong></span>
            <span>Unpaid Debt Carried to Next Month: <strong style={{ color: advanceCf > 0 ? '#dc2626' : '#16a34a' }}>Rs. {advanceCf.toFixed(2)}</strong></span>
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#9ca3af' }}>
          This is a computer-generated payslip. No signature is required.
        </div>
      </div>
    </div>
  );
};

export default SalarySlipPDF;
