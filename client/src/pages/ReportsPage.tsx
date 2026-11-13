import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Calendar, Banknote } from 'lucide-react';
import api from '../api/client';
import Topbar from '../components/Topbar';

export const ReportsPage: React.FC = () => {
  const now = new Date();
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [attMonth, setAttMonth] = useState<number>(now.getMonth() + 1);
  const [attYear, setAttYear] = useState<number>(now.getFullYear());
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.get('/salary/periods').then(res => {
      const list = res.data?.data || [];
      setPeriods(list);
      if (list.length > 0) setSelectedPeriod(String(list[0].id));
    }).catch(console.error);
  }, []);

  const handleDownloadSalary = async () => {
    if (!selectedPeriod) return;
    try {
      setDownloading('salary');
      const response = await api.get(`/reports/salary/excel?period_id=${selectedPeriod}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Salary_Sheet_Period_${selectedPeriod}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to generate salary report');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAttendance = async () => {
    try {
      setDownloading('attendance');
      const response = await api.get(`/reports/attendance/excel?month=${attMonth}&year=${attYear}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_${attYear}_${attMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to generate attendance report');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <Topbar title="Export & Reports" subtitle="Generate standardized Excel spreadsheets for payroll and compliance" />

      <div className="page-container" style={{ maxWidth: '1000px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Salary Sheet Export Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-primary)' }}>
                <Banknote size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Salary Sheet Export</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Full 15-column breakdown with deductions & net pay</p>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Select Salary Period</label>
              <select
                className="form-input"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    Cycle: {p.month}/{p.year} ({p.is_locked ? 'Finalized' : 'Draft'})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={downloading === 'salary' || !selectedPeriod}
              onClick={handleDownloadSalary}
            >
              <FileSpreadsheet size={16} />
              {downloading === 'salary' ? 'Generating Excel...' : 'Export Salary to Excel (.xlsx)'}
            </button>
          </div>

          {/* Attendance Report Export Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <Calendar size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Attendance Audit Export</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Punch timings, late arrival flags, overtime hours</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Month</label>
                <select
                  className="form-input"
                  value={attMonth}
                  onChange={(e) => setAttMonth(Number(e.target.value))}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={attYear}
                  onChange={(e) => setAttYear(Number(e.target.value))}
                />
              </div>
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={downloading === 'attendance'}
              onClick={handleDownloadAttendance}
            >
              <Download size={16} />
              {downloading === 'attendance' ? 'Generating Report...' : 'Export Attendance to Excel (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
