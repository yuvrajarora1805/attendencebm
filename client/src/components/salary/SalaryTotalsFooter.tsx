import React from 'react';
import { Calculator } from 'lucide-react';

export interface SalaryTotals {
  basic: number;
  leavesDed: number;
  advGiven: number;
  advDed: number;
  incentives: number;
  otherDed: number;
  netPayable: number;
}

interface Props {
  totals: SalaryTotals;
  employeeCount: number;
  isLocked: boolean;
}

export const SalaryTotalsFooter: React.FC<Props> = ({ totals, employeeCount, isLocked }) => {
  return (
    <tfoot>
      <tr className="table-totals-row" style={{ height: '48px' }}>
        <td colSpan={2} style={{ paddingLeft: '16px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800 }}>
            <Calculator size={15} color="var(--primary-600)" />
            TOTALS ({employeeCount} EMPLOYEES)
          </span>
        </td>
        <td className="billing-cell-num" style={{ fontSize: '14px', fontWeight: 800 }}>
          ₹{totals.basic.toLocaleString('en-IN')}
        </td>
        <td colSpan={3}></td>
        <td className="billing-cell-num" style={{ color: 'var(--accent-danger)', fontWeight: 800 }}>
          -₹{totals.leavesDed.toLocaleString('en-IN')}
        </td>
        <td className="billing-cell-num" style={{ fontWeight: 800 }}>
          ₹{totals.advGiven.toLocaleString('en-IN')}
        </td>
        <td className="billing-cell-num" style={{ color: 'var(--accent-danger)', fontWeight: 800 }}>
          -₹{totals.advDed.toLocaleString('en-IN')}
        </td>
        <td></td>
        <td className="billing-cell-num" style={{ color: 'var(--accent-success)', fontWeight: 800 }}>
          +₹{totals.incentives.toLocaleString('en-IN')}
        </td>
        <td className="billing-cell-num" style={{ color: 'var(--accent-danger)', fontWeight: 800 }}>
          -₹{totals.otherDed.toLocaleString('en-IN')}
        </td>
        <td className="billing-cell-bold" style={{ fontSize: '18px', color: 'var(--primary-700)', fontWeight: 900 }}>
          ₹{totals.netPayable.toLocaleString('en-IN')}
        </td>
        <td colSpan={isLocked ? 1 : 2}></td>
      </tr>
    </tfoot>
  );
};

export default SalaryTotalsFooter;
