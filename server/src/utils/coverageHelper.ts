import pool from '../db/connection';
import { getConnectedStorageDevices, StorageDevice } from './deviceHelper';

export interface MonthCoverage {
  month: string; // 'YYYY-MM'
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
  gaps: DataGap[];
}

export async function getServerCoverageReport(): Promise<{ coverage: CoverageReport; devices: StorageDevice[] }> {
  // 1. Attendance statistics
  const [attStats] = await pool.query<any[]>(
    'SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as count FROM attendance_records WHERE is_archived = 0'
  );
  const minDate = attStats[0]?.min_date ? new Date(attStats[0].min_date).toISOString().slice(0, 10) : null;
  const maxDate = attStats[0]?.max_date ? new Date(attStats[0].max_date).toISOString().slice(0, 10) : null;
  const totalAttendance = Number(attStats[0]?.count || 0);

  // 2. Attendance monthly breakdown
  const [attMonths] = await pool.query<any[]>(
    "SELECT DATE_FORMAT(date, '%Y-%m') as ym, COUNT(*) as count FROM attendance_records WHERE is_archived = 0 GROUP BY ym ORDER BY ym ASC"
  );
  const attMap: Record<string, number> = {};
  for (const r of attMonths) attMap[r.ym] = Number(r.count);

  // 3. Salary monthly breakdown
  const [salRows] = await pool.query<any[]>(
    "SELECT CONCAT(sp.year, '-', LPAD(sp.month, 2, '0')) as ym, COUNT(se.id) as count FROM salary_periods sp LEFT JOIN salary_entries se ON sp.id = se.period_id GROUP BY ym ORDER BY ym ASC"
  );
  const salMap: Record<string, number> = {};
  let totalSalary = 0;
  for (const r of salRows) {
    salMap[r.ym] = Number(r.count);
    totalSalary += Number(r.count);
  }

  // 4. Combined distinct months
  const allMonthsSet = new Set<string>([...Object.keys(attMap), ...Object.keys(salMap)]);
  const availableMonths: MonthCoverage[] = Array.from(allMonthsSet).sort().map(m => ({
    month: m,
    attendance_count: attMap[m] || 0,
    salary_count: salMap[m] || 0,
    has_data: (attMap[m] || 0) > 0 || (salMap[m] || 0) > 0
  }));

  // 5. Gap detection between earliest month and latest month (or current month)
  const gaps: DataGap[] = [];
  if (availableMonths.length > 0) {
    const sorted = [...availableMonths].sort((a, b) => a.month.localeCompare(b.month));
    const firstMonthStr = sorted[0].month;
    const lastMonthStr = sorted[sorted.length - 1].month;

    let [fy, fm] = firstMonthStr.split('-').map(Number);
    const [ly, lm] = lastMonthStr.split('-').map(Number);

    let currentGapStart: string | null = null;
    let currentGapCount = 0;
    let prevMissing: string | null = null;

    while (fy < ly || (fy === ly && fm <= lm)) {
      const ym = `${fy}-${String(fm).padStart(2, '0')}`;
      if (!allMonthsSet.has(ym)) {
        if (!currentGapStart) currentGapStart = ym;
        prevMissing = ym;
        currentGapCount++;
      } else {
        if (currentGapStart && prevMissing) {
          gaps.push({ from_month: currentGapStart, to_month: prevMissing, missing_months: currentGapCount });
          currentGapStart = null;
          currentGapCount = 0;
          prevMissing = null;
        }
      }
      fm++;
      if (fm > 12) { fm = 1; fy++; }
    }
    if (currentGapStart && prevMissing) {
      gaps.push({ from_month: currentGapStart, to_month: prevMissing, missing_months: currentGapCount });
    }
  }

  // 6. Connected Storage Devices (Phone, USB, Drives)
  const devices = getConnectedStorageDevices();

  return {
    coverage: {
      min_date: minDate,
      max_date: maxDate,
      total_attendance: totalAttendance,
      total_salary: totalSalary,
      available_months: availableMonths,
      gaps
    },
    devices
  };
}
