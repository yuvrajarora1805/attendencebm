import React from 'react';
import { FileText, Save, Check } from 'lucide-react';
import SalaryModifiedSubrow, { RowModification } from './SalaryModifiedSubrow';

interface Props {
  row: any;
  isLocked: boolean;
  mod?: RowModification;
  onCellChange: (id: number, field: string, val: number) => void;
  onSave: (row: any) => void;
  onViewPayslip: (row: any) => void;
  onToggleSubrow: (id: number) => void;
}

export const SalaryTableRow: React.FC<Props> = ({
  row: r,
  isLocked,
  mod,
  onCellChange,
  onSave,
  onViewPayslip,
  onToggleSubrow,
}) => {
  const getCellClass = (field: string) => {
    if (!mod?.fields[field]) return '';
    return mod.saved ? 'cell-saved' : 'cell-edited';
  };

  const rowClass = mod
    ? mod.saved ? 'row-saved' : 'row-edited'
    : '';

  return (
    <React.Fragment>
      <tr className={rowClass}>
        <td><strong style={{ color: 'var(--primary-700)', fontSize: '13px' }}>{r.emp_code}</strong></td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.emp_name || r.name}</span>
            {r.employee_status === 'inactive' && (
              <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 5px' }}>
                Inactive
              </span>
            )}
            {Boolean(r.is_new_joining) && (
              <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }} title="Probationary New Joiner (< 6 Months)">
                🌱 &lt; 6M
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span>{r.department_name || r.job_role || 'Staff'}</span>
            {mod && (
              <button
                onClick={() => onToggleSubrow(r.id)}
                className={`badge ${mod.saved ? 'badge-success' : 'badge-warning'}`}
                style={{ fontSize: '10px', padding: '1px 6px', border: 'none', cursor: 'pointer' }}
                title="Toggle change log row"
              >
                {mod.saved ? '✓ Saved' : '● Edited'}
              </button>
            )}
          </div>
          {(r.incentive_remarks || r.deduction_remarks) && (
            <div style={{ fontSize: '10px', marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {r.incentive_remarks && (
                <span style={{ color: '#15803d' }}>🎁 {r.incentive_remarks}</span>
              )}
              {r.deduction_remarks && (
                <span style={{ color: '#b91c1c' }}>🔻 {r.deduction_remarks}</span>
              )}
            </div>
          )}
        </td>

        {/* Editable Basic Salary */}
        <td style={{ textAlign: 'right' }}>
          {isLocked ? (
            <span className="billing-cell-num">₹{Number(r.basic_salary).toLocaleString()}</span>
          ) : (
            <input
              type="number"
              step="500"
              className={`table-cell-input billing-cell-num ${getCellClass('basic_salary')}`}
              style={{ fontWeight: 700 }}
              value={r.basic_salary}
              onChange={(e) => onCellChange(r.id, 'basic_salary', parseFloat(e.target.value) || 0)}
              title="Edit basic salary"
            />
          )}
        </td>

        <td className="billing-cell-num" style={{ color: 'var(--text-secondary)' }}>
          ₹{Number(r.salary_per_day).toFixed(1)}
        </td>

        <td style={{ textAlign: 'center', fontWeight: 700 }}>
          <span className="badge badge-info" style={{ fontSize: '11px', padding: '2px 5px' }}>{r.present_days}d</span>
        </td>

        <td style={{ textAlign: 'center' }}>
          {isLocked ? r.final_leaves : (
            <input
              type="number"
              step="0.5"
              className={`table-cell-input ${getCellClass('final_leaves')}`}
              style={{ textAlign: 'center', fontWeight: 600 }}
              value={r.final_leaves}
              onChange={(e) => onCellChange(r.id, 'final_leaves', parseFloat(e.target.value) || 0)}
            />
          )}
        </td>

        <td className="billing-cell-num" style={{ color: 'var(--accent-danger)' }}>
          -₹{Number(r.leaves_amount).toFixed(0)}
        </td>

        <td style={{ textAlign: 'right' }}>
          {isLocked ? `₹${Number(r.advance_given).toFixed(0)}` : (
            <input
              type="number"
              className={`table-cell-input billing-cell-num ${getCellClass('advance_given')}`}
              value={r.advance_given}
              onChange={(e) => onCellChange(r.id, 'advance_given', parseFloat(e.target.value) || 0)}
            />
          )}
        </td>

        <td style={{ textAlign: 'right' }}>
          {isLocked ? `₹${Number(r.advance_deduction).toFixed(0)}` : (
            <input
              type="number"
              className={`table-cell-input billing-cell-num ${getCellClass('advance_deduction')}`}
              style={{ color: 'var(--accent-danger)' }}
              value={r.advance_deduction}
              onChange={(e) => onCellChange(r.id, 'advance_deduction', parseFloat(e.target.value) || 0)}
            />
          )}
        </td>

        <td className="billing-cell-num" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
          ₹{Number(r.advance_cf).toFixed(0)}
        </td>

        <td style={{ textAlign: 'right' }}>
          {isLocked ? `₹${Number(r.other_incentives).toFixed(0)}` : (
            <input
              type="number"
              className={`table-cell-input billing-cell-num ${getCellClass('other_incentives')}`}
              style={{ color: 'var(--accent-success)' }}
              value={r.other_incentives}
              onChange={(e) => onCellChange(r.id, 'other_incentives', parseFloat(e.target.value) || 0)}
            />
          )}
        </td>

        <td style={{ textAlign: 'right' }}>
          {isLocked ? `₹${Number(r.other_deduction).toFixed(0)}` : (
            <input
              type="number"
              className={`table-cell-input billing-cell-num ${getCellClass('other_deduction')}`}
              style={{ color: 'var(--accent-danger)' }}
              value={r.other_deduction}
              onChange={(e) => onCellChange(r.id, 'other_deduction', parseFloat(e.target.value) || 0)}
            />
          )}
        </td>

        <td className="billing-cell-bold" style={{ fontSize: '16px', color: 'var(--primary-700)' }}>
          ₹{Number(r.gross_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </td>

        <td style={{ textAlign: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onViewPayslip(r)} title="Print / View Payslip">
            <FileText size={14} color="var(--primary-600)" />
          </button>
        </td>

        {!isLocked && (
          <td style={{ textAlign: 'center' }}>
            {mod?.saved ? (
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--accent-success)', borderColor: 'var(--accent-success-border)', background: 'var(--accent-success-tint)', padding: '4px 8px' }}
                onClick={() => onSave(r)}
                title="Saved to server! Click to re-save"
              >
                <Check size={13} />
                <span>Saved</span>
              </button>
            ) : (
              <button
                className={`btn ${mod ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                style={mod ? { boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)', padding: '4px 8px' } : { padding: '4px 8px' }}
                onClick={() => onSave(r)}
                title={mod ? 'Unsaved edits — Click to save' : 'Save row'}
              >
                <Save size={13} />
                <span>Save</span>
              </button>
            )}
          </td>
        )}
      </tr>

      {/* Separate subrow when edited / saved */}
      {mod && (
        <SalaryModifiedSubrow
          entry={r}
          mod={mod}
          colSpan={isLocked ? 14 : 15}
          onSave={() => onSave(r)}
          onToggle={() => onToggleSubrow(r.id)}
        />
      )}
    </React.Fragment>
  );
};

export default SalaryTableRow;
