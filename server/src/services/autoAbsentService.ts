import pool from '../db/connection';

/**
 * Automatically marks unpunched active employees as absent for a target date
 * and ensures any approved leaves are accurately synced.
 */
export async function processAutoAbsent(targetDate?: string, systemUserId?: number): Promise<{ markedAbsent: number; markedLeave: number }> {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const userId = systemUserId || 1;

  let markedLeave = 0;
  let markedAbsent = 0;

  try {
    // 1. Sync any approved leaves from leave_records for dateStr that are missing in attendance_records
    const [missingLeaves]: any = await pool.query(
      `SELECT lr.emp_id, lr.leave_type, lr.reason
       FROM leave_records lr
       JOIN employees e ON lr.emp_id = e.id
       WHERE lr.status = 'approved'
         AND ? BETWEEN lr.from_date AND lr.to_date
         AND e.status = 'active'
         AND lr.emp_id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ? AND is_archived = 0)`,
      [dateStr, dateStr]
    );

    for (const ml of missingLeaves) {
      await pool.query(
        `INSERT INTO attendance_records (emp_id, date, status, notes, punched_by)
         VALUES (?, ?, 'leave', ?, ?)
         ON DUPLICATE KEY UPDATE status = 'leave', notes = VALUES(notes)`,
        [ml.emp_id, dateStr, `[Leave: ${String(ml.leave_type).toUpperCase()}] ${ml.reason || ''}`.trim(), userId]
      );
      markedLeave++;
    }

    // 2. Query all active employees with no record at all for dateStr
    const [unpunched]: any = await pool.query(
      `SELECT e.id, e.emp_code, e.name
       FROM employees e
       WHERE e.status = 'active'
         AND e.id NOT IN (SELECT emp_id FROM attendance_records WHERE date = ? AND is_archived = 0)`,
      [dateStr]
    );

    for (const emp of unpunched) {
      await pool.query(
        `INSERT IGNORE INTO attendance_records (emp_id, date, status, punched_by, notes)
         VALUES (?, ?, 'absent', ?, 'Auto-marked absent: Not present')`,
        [emp.id, dateStr, userId]
      );
      markedAbsent++;
    }

    return { markedAbsent, markedLeave };
  } catch (err) {
    console.error(`[AutoAbsentService] Error processing date ${dateStr}:`, err);
    throw err;
  }
}

/**
 * Initializes a background timer that checks past dates and shift end
 * to auto-mark absent. Runs hourly.
 */
export function initAutoAbsentScheduler() {
  const checkAndRun = async () => {
    try {
      const now = new Date();
      // Auto-run for today if past 21:00 (9 PM), or always audit yesterday
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const resYesterday = await processAutoAbsent(yesterday);
      if (resYesterday.markedAbsent > 0 || resYesterday.markedLeave > 0) {
        console.log(`[AutoAbsentService] Auto-marked for yesterday (${yesterday}): ${resYesterday.markedAbsent} absent, ${resYesterday.markedLeave} leave.`);
      }

      // If current time is after 21:00 (9 PM), also run for today's completed shift
      if (now.getHours() >= 21) {
        const today = now.toISOString().split('T')[0];
        const resToday = await processAutoAbsent(today);
        if (resToday.markedAbsent > 0 || resToday.markedLeave > 0) {
          console.log(`[AutoAbsentService] Auto-marked for today (${today}): ${resToday.markedAbsent} absent, ${resToday.markedLeave} leave.`);
        }
      }
    } catch (err) {
      console.error('[AutoAbsentService] Scheduled check error:', err);
    }
  };

  // Run initial check after 10 seconds of server boot
  setTimeout(checkAndRun, 10000);
  // Check every hour
  setInterval(checkAndRun, 60 * 60 * 1000);
}
