import React from 'react';
import { Calendar, Database } from 'lucide-react';

export interface MonthCoverage {
  month: string;
  attendance_count: number;
  salary_count: number;
  has_data: boolean;
}

export interface DataGap {
  from_month: string;
  to_month: string;
  missing_months: number;
}

export interface CoverageReport {
  min_date: string | null;
  max_date: string | null;
  total_attendance: number;
  total_salary: number;
  available_months: MonthCoverage[];
  gaps?: DataGap[];
}

interface Props {
  coverage: CoverageReport | null;
  onSelectDuration: (from: string, to: string) => void;
}

export const DataCoverageTimeline: React.FC<Props> = ({ coverage, onSelectDuration }) => {
  if (!coverage) {
    return (
      <div className="card" style={{ marginBottom: '20px', textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
        Loading server data coverage...
      </div>
    );
  }

  const { min_date, max_date, total_attendance, total_salary, available_months } = coverage;

  const handlePickMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    onSelectDuration(`${m}-01`, `${m}-${String(lastDay).padStart(2, '0')}`);
  };

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="var(--primary-600)" />
          Server Data Timeline & Available Durations
        </h3>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span><strong>{total_attendance}</strong> attendance records</span>
          <span>·</span>
          <span><strong>{total_salary}</strong> salary entries</span>
          <span>·</span>
          <span>Timeline: <strong>{min_date || 'N/A'}</strong> to <strong>{max_date || 'N/A'}</strong></span>
        </div>
      </div>

      {/* Available Data Months */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Live Data Present on Server (Click duration to select for delete/archive):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {available_months.length === 0 ? (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No records found in server database.</span>
          ) : (
            available_months.map(m => (
              <button
                key={m.month}
                onClick={() => handlePickMonth(m.month)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px' }}
                title={`Click to set scope: ${m.month}`}
              >
                <Calendar size={13} color="var(--primary-600)" />
                <strong>{m.month}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  ({m.attendance_count} att{m.salary_count > 0 ? `, ${m.salary_count} sal` : ''})
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DataCoverageTimeline;
