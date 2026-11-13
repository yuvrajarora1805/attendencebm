import React, { useState, useEffect, useRef } from 'react';
import { Search, X, User, Check, ChevronDown } from 'lucide-react';

export interface EmployeeOption {
  id: number | string;
  emp_code: string;
  name: string;
  department_name?: string;
  dept_name?: string;
  job_role?: string;
  status?: string;
  [key: string]: any;
}

interface SearchableEmployeeSelectProps {
  employees: EmployeeOption[];
  value: string | number;
  onChange: (selectedId: string, employee?: EmployeeOption | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  requireQuery?: boolean; // When true, hides the employee names list until user types a search query
}

export const SearchableEmployeeSelect: React.FC<SearchableEmployeeSelectProps> = ({
  employees,
  value,
  onChange,
  placeholder = 'Type Employee ID / Code (e.g. 7040) or Name...',
  label,
  required = false,
  disabled = false,
  autoFocus = false,
  requireQuery = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedEmp = employees.find(e => String(e.id) === String(value));

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = searchTerm.trim().toLowerCase();

  const filtered = employees.filter(emp => {
    if (!normalizedQuery) return true;
    const code = (emp.emp_code || '').toLowerCase();
    const name = (emp.name || '').toLowerCase();
    const dept = (emp.department_name || emp.dept_name || '').toLowerCase();
    const role = (emp.job_role || '').toLowerCase();

    // Direct prefix match or substring match
    return code.includes(normalizedQuery) ||
           name.includes(normalizedQuery) ||
           dept.includes(normalizedQuery) ||
           role.includes(normalizedQuery);
  });

  const handleSelect = (emp: EmployeeOption) => {
    onChange(String(emp.id), emp);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="form-group" ref={wrapperRef} style={{ position: 'relative', marginBottom: '14px' }}>
      {label && (
        <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</span>
          {selectedEmp && (
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
              ✓ Selected: {selectedEmp.emp_code}
            </span>
          )}
        </label>
      )}

      {/* Hidden input for HTML form requirement validation */}
      <input
        type="text"
        value={value ? String(value) : ''}
        onChange={() => {}}
        required={required}
        style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        tabIndex={-1}
      />

      {/* Main Select / Search Box */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          background: disabled ? 'var(--bg-secondary)' : '#ffffff',
          border: isOpen ? '1.5px solid var(--accent-primary, #3b82f6)' : '1px solid var(--border-color, #cbd5e1)',
          borderRadius: '8px',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '4px 8px',
          minHeight: '42px'
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        {selectedEmp && !isOpen ? (
          // Display when an employee is selected and dropdown is closed
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px', padding: '2px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.02em',
                  border: '1px solid #bfdbfe'
                }}
              >
                {selectedEmp.emp_code}
              </span>
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedEmp.name}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                ({selectedEmp.department_name || selectedEmp.dept_name || 'Staff'})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handleClear}
                title="Change Employee"
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#475569',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <X size={12} /> Change
              </button>
            </div>
          </div>
        ) : (
          // Active Search Input
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
            <Search size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedEmp ? `${selectedEmp.emp_code} - ${selectedEmp.name} (type to change...)` : placeholder}
              value={searchTerm}
              autoFocus={autoFocus}
              disabled={disabled}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault();
                  handleSelect(filtered[0]);
                }
              }}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                background: 'transparent',
                color: 'var(--text-primary, #0f172a)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
          </div>
        )}
      </div>

      {/* Dropdown Options List */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1200,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          {searchTerm && (
            <div style={{ padding: '6px 10px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
              <span>Searching for: <strong>"{searchTerm}"</strong></span>
              <span>{filtered.length} matches found</span>
            </div>
          )}

          {requireQuery && !searchTerm.trim() ? (
            <div style={{ padding: '22px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>⌨️</div>
              <div style={{ fontWeight: 700, color: '#334155', fontSize: '13px' }}>
                Enter Employee ID / Code to search
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                Type numeric code (e.g. 7040 or 0100) or name to find the employee
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              <div>🔍 No employees found matching <strong>"{searchTerm}"</strong></div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Try entering just the numeric code (e.g. 7040)</div>
            </div>
          ) : (
            filtered.slice(0, 35).map((emp) => {
              const isSelected = String(emp.id) === String(value);
              const joinDate = emp.joining_date ? new Date(emp.joining_date) : null;
              const isUnder6Months = Boolean(emp.is_new_joining) || (joinDate ? (
                (new Date().getTime() - joinDate.getTime()) < (183 * 24 * 60 * 60 * 1000)
              ) : false);

              let itemBackground = 'transparent';
              if (isSelected) {
                itemBackground = isUnder6Months ? '#fef3c7' : '#eff6ff';
              } else if (isUnder6Months) {
                itemBackground = 'rgba(245, 158, 11, 0.08)';
              }

              return (
                <div
                  key={emp.id}
                  onClick={() => handleSelect(emp)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    background: itemBackground,
                    border: isUnder6Months ? '1px solid #fde68a' : '1px solid transparent',
                    transition: 'background 0.1s ease',
                    marginBottom: '3px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = isUnder6Months ? '#fef3c7' : '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = itemBackground;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span
                      style={{
                        background: isSelected ? (isUnder6Months ? '#f59e0b' : '#3b82f6') : (isUnder6Months ? '#fde68a' : '#f1f5f9'),
                        color: isSelected ? '#ffffff' : (isUnder6Months ? '#78350f' : '#1e293b'),
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                        flexShrink: 0
                      }}
                    >
                      {emp.emp_code}
                    </span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{emp.name}</span>
                        {isUnder6Months && (
                          <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '1px 5px' }} title="Worked less than 6 months">
                            ⚠️ &lt; 6M
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {emp.department_name || emp.dept_name || 'Staff'} {emp.job_role ? `• ${emp.job_role}` : ''}
                        {joinDate && (
                          <span style={{ marginLeft: '6px', color: isUnder6Months ? '#b45309' : 'inherit' }}>
                            (Joined: {emp.joining_date.slice(0, 10)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ color: isUnder6Months ? '#d97706' : '#2563eb', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}>
                      <Check size={14} /> Selected
                    </div>
                  )}
                </div>
              );
            })
          )}

          {filtered.length > 35 && (
            <div style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
              Showing top 35 results. Type more digits to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableEmployeeSelect;

