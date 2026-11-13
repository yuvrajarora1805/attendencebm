import React, { useState } from 'react';
import SalaryTotalsFooter, { SalaryTotals } from '../components/salary/SalaryTotalsFooter';
import SalaryTableRow from '../components/salary/SalaryTableRow';
import { RowModification } from '../components/salary/SalaryModifiedSubrow';

interface SalaryTableProps {
  entries: any[];
  isLocked: boolean;
  onEntryChange: (id: number, field: string, value: number) => void;
  onSaveRow: (row: any) => Promise<void> | void;
  onViewPayslip: (row: any) => void;
}

export const SalaryTable: React.FC<SalaryTableProps> = ({
  entries,
  isLocked,
  onEntryChange,
  onSaveRow,
  onViewPayslip,
}) => {
  const [modifiedRows, setModifiedRows] = useState<Record<number, RowModification>>({});

  const handleCellChange = (id: number, field: string, val: number) => {
    setModifiedRows((prev) => {
      const existing = prev[id] || { fields: {}, saved: false, expanded: true };
      const rowItem = entries.find((e) => e.id === id);
      const orig = existing.fields[field] !== undefined
        ? existing.fields[field].original
        : Number(rowItem?.[field] ?? 0);

      return {
        ...prev,
        [id]: {
          ...existing,
          saved: false,
          expanded: true,
          fields: {
            ...existing.fields,
            [field]: { original: orig, current: val }
          }
        }
      };
    });
    onEntryChange(id, field, val);
  };

  const handleSave = async (row: any) => {
    await onSaveRow(row);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setModifiedRows((prev) => {
      const existing = prev[row.id] || { fields: {}, saved: false, expanded: true };
      return {
        ...prev,
        [row.id]: {
          ...existing,
          saved: true,
          savedAt: now,
          expanded: true
        }
      };
    });
  };

  const handleToggleSubrow = (id: number) => {
    setModifiedRows((prev) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], expanded: !prev[id].expanded }
      };
    });
  };

  const totals: SalaryTotals = entries.reduce((acc, r) => {
    acc.basic += Number(r.basic_salary || 0);
    acc.leavesDed += Number(r.leaves_amount || 0);
    acc.advGiven += Number(r.advance_given || 0);
    acc.advDed += Number(r.advance_deduction || 0);
    acc.incentives += Number(r.other_incentives || 0);
    acc.otherDed += Number(r.other_deduction || 0);
    acc.netPayable += Number(r.gross_amount || 0);
    return acc;
  }, { basic: 0, leavesDed: 0, advGiven: 0, advDed: 0, incentives: 0, otherDed: 0, netPayable: 0 });

  return (
    <div className="table-wrapper" style={{ boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)' }}>
      <table className="data-table" style={{ fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '65px', width: '70px' }}>Code</th>
            <th style={{ minWidth: '120px' }}>Employee</th>
            <th style={{ textAlign: 'right', minWidth: '95px' }}>Basic Salary</th>
            <th style={{ textAlign: 'right', minWidth: '70px' }}>Per Day</th>
            <th style={{ textAlign: 'center', minWidth: '55px' }}>Present</th>
            <th style={{ textAlign: 'center', minWidth: '55px' }}>Leaves</th>
            <th style={{ textAlign: 'right', minWidth: '80px' }}>Leaves Ded.</th>
            <th style={{ textAlign: 'right', minWidth: '80px' }}>Adv Given</th>
            <th style={{ textAlign: 'right', minWidth: '80px' }}>Adv Ded.</th>
            <th style={{ textAlign: 'right', minWidth: '75px' }}>Adv C/F</th>
            <th style={{ textAlign: 'right', minWidth: '75px' }}>Incentives</th>
            <th style={{ textAlign: 'right', minWidth: '75px' }}>Other Ded.</th>
            <th style={{ textAlign: 'right', minWidth: '110px' }}>Net Gross Payable</th>
            <th style={{ textAlign: 'center', minWidth: '40px' }}>Slip</th>
            {!isLocked && <th style={{ textAlign: 'center', minWidth: '75px' }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={15} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No salary entries found for this cycle. Click "Calculate / Sync" to calculate from attendance.
              </td>
            </tr>
          ) : (
            entries.map((r) => (
              <SalaryTableRow
                key={r.id}
                row={r}
                isLocked={isLocked}
                mod={modifiedRows[r.id]}
                onCellChange={handleCellChange}
                onSave={handleSave}
                onViewPayslip={onViewPayslip}
                onToggleSubrow={handleToggleSubrow}
              />
            ))
          )}
        </tbody>

        {entries.length > 0 && (
          <SalaryTotalsFooter totals={totals} employeeCount={entries.length} isLocked={isLocked} />
        )}
      </table>
    </div>
  );
};

export default SalaryTable;
