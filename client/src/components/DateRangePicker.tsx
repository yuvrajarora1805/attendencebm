import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const setPreset = (type: 'thisMonth' | 'lastMonth' | 'last90') => {
    const now = new Date();
    if (type === 'thisMonth') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const first = new Date(y, m, 1).toISOString().slice(0, 10);
      const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      onChange(first, last);
    } else if (type === 'lastMonth') {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const first = new Date(y, m, 1).toISOString().slice(0, 10);
      const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      onChange(first, last);
    } else if (type === 'last90') {
      const past = new Date();
      past.setDate(past.getDate() - 90);
      onChange(past.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          type="date"
          className="form-input"
          style={{ width: '130px', height: '34px', fontSize: '12px' }}
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
        <input
          type="date"
          className="form-input"
          style={{ width: '130px', height: '34px', fontSize: '12px' }}
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={() => setPreset('thisMonth')}
        >
          This Month
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={() => setPreset('lastMonth')}
        >
          Last Month
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={() => setPreset('last90')}
        >
          90 Days
        </button>
      </div>
    </div>
  );
};

export default DateRangePicker;
