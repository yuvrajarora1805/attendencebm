import React from 'react';
import { CheckCircle2, AlertCircle, Save, ChevronUp, Clock } from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  basic_salary: 'Basic Salary',
  salary_per_day: 'Per Day',
  final_leaves: 'Leaves',
  advance_given: 'Advance Given',
  advance_deduction: 'Advance Ded.',
  other_incentives: 'Incentives',
  other_deduction: 'Other Ded.',
};

export interface ModifiedFieldDetail {
  original: number;
  current: number;
}

export interface RowModification {
  fields: Record<string, ModifiedFieldDetail>;
  saved: boolean;
  savedAt?: string;
  expanded?: boolean;
}

interface Props {
  entry: any;
  mod: RowModification;
  colSpan: number;
  onSave: () => void;
  onToggle: () => void;
}

export const SalaryModifiedSubrow: React.FC<Props> = ({
  entry,
  mod,
  colSpan,
  onSave,
  onToggle,
}) => {
  if (!mod.expanded) return null;

  const isSaved = mod.saved;
  const fieldKeys = Object.keys(mod.fields);

  return (
    <tr
      className={`modified-subrow ${isSaved ? 'modified-subrow-saved' : 'modified-subrow-unsaved'}`}
      style={{
        background: isSaved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)',
        borderLeft: isSaved ? '4px solid #10b981' : '4px solid #0284c7',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <td colSpan={colSpan} style={{ padding: '6px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          
          {/* Left: Change log chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: isSaved ? '#10b981' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ↳ Row {entry.emp_code} ({entry.emp_name || entry.name}):
            </span>

            {fieldKeys.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Row updated</span>
            ) : (
              fieldKeys.map((key) => {
                const label = FIELD_LABELS[key] || key;
                const orig = mod.fields[key].original;
                const curr = mod.fields[key].current;
                const diff = curr - orig;

                return (
                  <span
                    key={key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--bg-main)',
                      border: `1px solid ${isSaved ? 'rgba(16, 185, 129, 0.4)' : 'rgba(2, 132, 199, 0.4)'}`,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    <strong style={{ color: 'var(--text-main)' }}>{label}:</strong>
                    <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                      {typeof orig === 'number' && key !== 'final_leaves' ? `₹${orig.toLocaleString()}` : orig}
                    </span>
                    <span style={{ color: isSaved ? 'var(--accent-success)' : 'var(--primary-600)', fontWeight: 800 }}>
                      → {typeof curr === 'number' && key !== 'final_leaves' ? `₹${curr.toLocaleString()}` : curr}
                    </span>
                    {diff !== 0 && key !== 'final_leaves' && (
                      <span style={{ fontSize: '10px', color: diff > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        ({diff > 0 ? `+₹${diff.toLocaleString()}` : `-₹${Math.abs(diff).toLocaleString()}`})
                      </span>
                    )}
                  </span>
                );
              })
            )}
          </div>

          {/* Right: Status & Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSaved ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11.5px', fontWeight: 700 }}>
                <CheckCircle2 size={13} />
                <span>Saved {mod.savedAt ? `@ ${mod.savedAt}` : 'to Database'}</span>
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary-600)', fontSize: '11.5px', fontWeight: 700 }}>
                  <AlertCircle size={13} />
                  <span>Unsaved Edit</span>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '11px', height: '24px' }}
                  onClick={onSave}
                >
                  <Save size={11} /> Save
                </button>
              </div>
            )}

            <button
              onClick={onToggle}
              title="Hide this log row"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
            >
              <ChevronUp size={14} />
            </button>
          </div>

        </div>
      </td>
    </tr>
  );
};

export default SalaryModifiedSubrow;
