import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchKey?: (row: T) => string;
  extraControls?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Search...',
  searchKey,
  extraControls,
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredData = useMemo(() => {
    if (!query.trim()) return data;
    const lower = query.toLowerCase();
    return data.filter(row => {
      if (searchKey) return searchKey(row).toLowerCase().includes(lower);
      return Object.values(row).some(
        val => val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      );
    });
  }, [data, query, searchKey]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pageData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />
        </div>
        {extraControls && <div style={{ display: 'flex', gap: '8px' }}>{extraControls}</div>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px' }}>
                  <span className="spinner" /> Loading data...
                </td>
              </tr>
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No records found.
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => (
                <tr 
                  key={row.id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  className={onRowClick ? 'clickable-row' : ''}
                >
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
        <span>Showing {filteredData.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredData.length)} of {filteredData.length} records</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Prev
          </button>
          <span style={{ padding: '4px 8px' }}>{page} / {totalPages}</span>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
