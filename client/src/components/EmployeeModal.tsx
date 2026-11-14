import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Sparkles, AlertCircle, ShieldAlert, Users, Phone, MapPin, Palmtree } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SearchableEmployeeSelect from './SearchableEmployeeSelect';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee?: any | null;
  departments: { id: number; name: string }[];
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  employee,
  departments,
}) => {
  const { hasRole } = useAuth();
  const isManager = hasRole('manager') && !hasRole('admin');

  const [formData, setFormData] = useState({
    emp_code: '',
    name: '',
    dept_id: '',
    designation: '',
    basic_salary: '',
    salary_per_day: '',
    increment_rate: '5.00',
    joining_date: '',
    phone: '',
    address: '',
    city_id: '',
    status: 'active',
    // Reference fields
    reference_type: 'none', // 'none' | 'internal' | 'external'
    referred_by_emp_id: '',
    referred_by_name: '',
    referred_by_phone: '',
    // Structured advance recovery
    monthly_advance_deduction: '',
    // Leave Policy
    monthly_leave_quota: '2.0',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  // Fetch sections/series details & staff list for reference dropdown
  useEffect(() => {
    if (isOpen) {
      api.get('/employees/series-info').then(res => {
        if (res.data?.data) {
          setSeriesList(res.data.data);
        }
      }).catch(err => console.error('Failed to load series info', err));

      api.get('/employees?status=active').then(res => {
        if (res.data?.data) {
          setAllEmployees(res.data.data);
        }
      }).catch(err => console.error('Failed to load employees for reference', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (employee) {
      const refType = employee.referred_by_emp_id 
        ? 'internal' 
        : (employee.referred_by_name ? 'external' : 'none');

      setFormData({
        emp_code: employee.emp_code || '',
        name: employee.name || '',
        dept_id: employee.department_id || employee.dept_id ? String(employee.department_id || employee.dept_id) : '',
        designation: employee.job_role || employee.designation || '',
        basic_salary: employee.basic_salary ? String(employee.basic_salary) : '',
        salary_per_day: employee.salary_per_day ? String(employee.salary_per_day) : '',
        increment_rate: employee.increment_rate ? String(employee.increment_rate) : '5.00',
        joining_date: employee.joining_date ? employee.joining_date.slice(0, 10) : '',
        phone: employee.phone || '',
        address: employee.address || '',
        city_id: employee.city_id ? String(employee.city_id) : '',
        status: employee.status || 'active',
        reference_type: refType,
        referred_by_emp_id: employee.referred_by_emp_id ? String(employee.referred_by_emp_id) : '',
        referred_by_name: employee.referred_by_name || '',
        referred_by_phone: employee.referred_by_phone || '',
        monthly_advance_deduction: employee.monthly_advance_deduction ? String(employee.monthly_advance_deduction) : '',
        monthly_leave_quota: employee.monthly_leave_quota !== undefined && employee.monthly_leave_quota !== null ? String(employee.monthly_leave_quota) : '2.0',
      });
    } else {
      const defaultDept = seriesList[0] || departments[0];
      const defaultDeptId = defaultDept ? String(defaultDept.dept_id || defaultDept.id) : '';
      const suggested = seriesList.find(s => String(s.dept_id) === defaultDeptId)?.next_suggested_code || '';

      setFormData({
        emp_code: suggested,
        name: '',
        dept_id: defaultDeptId,
        designation: '',
        basic_salary: '',
        salary_per_day: '',
        increment_rate: '5.00',
        joining_date: new Date().toISOString().split('T')[0],
        phone: '',
        address: '',
        city_id: '',
        status: 'active',
        reference_type: 'none',
        referred_by_emp_id: '',
        referred_by_name: '',
        referred_by_phone: '',
        monthly_advance_deduction: '',
        monthly_leave_quota: '2.0',
      });
    }
    setError('');
  }, [employee, departments, seriesList, isOpen]);

  if (!isOpen) return null;

  const handleDepartmentChange = (selectedId: string) => {
    const matchedSeries = seriesList.find(s => String(s.dept_id) === String(selectedId));
    setFormData(prev => ({
      ...prev,
      dept_id: selectedId,
      emp_code: !employee && matchedSeries?.next_suggested_code ? matchedSeries.next_suggested_code : prev.emp_code
    }));
  };

  const handleSalaryChange = (val: string) => {
    const num = parseFloat(val);
    const perDay = !isNaN(num) && num > 0 ? (num / 30).toFixed(2) : '';
    setFormData(prev => ({ ...prev, basic_salary: val, salary_per_day: perDay }));
  };

  const currentSeries = seriesList.find(s => String(s.dept_id) === String(formData.dept_id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.emp_code) {
      setError('Employee name and code are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload: any = {
        emp_code: formData.emp_code,
        name: formData.name,
        department_id: formData.dept_id ? Number(formData.dept_id) : null,
        job_role: formData.designation || null,
        basic_salary: parseFloat(formData.basic_salary) || 0,
        salary_per_day: parseFloat(formData.salary_per_day) || 0,
        increment_rate: parseFloat(formData.increment_rate) || 5.0,
        joining_date: formData.joining_date || null,
        phone: formData.phone || null,
        address: formData.address || null,
        status: formData.status || 'active',
        monthly_advance_deduction: employee?.monthly_advance_deduction !== undefined ? Number(employee.monthly_advance_deduction) : (parseFloat(formData.monthly_advance_deduction) || 0),
        monthly_leave_quota: isManager 
          ? (employee?.monthly_leave_quota !== undefined ? Number(employee.monthly_leave_quota) : 2.0)
          : (parseFloat(formData.monthly_leave_quota) ?? 2.0),
      };

      // Reference details
      if (formData.reference_type === 'internal') {
        payload.referred_by_emp_id = formData.referred_by_emp_id ? Number(formData.referred_by_emp_id) : null;
        payload.referred_by_name = null;
        payload.referred_by_phone = null;
      } else if (formData.reference_type === 'external') {
        payload.referred_by_emp_id = null;
        payload.referred_by_name = formData.referred_by_name || null;
        payload.referred_by_phone = formData.referred_by_phone || null;
      } else {
        payload.referred_by_emp_id = null;
        payload.referred_by_name = null;
        payload.referred_by_phone = null;
      }

      if (employee?.id) {
        await api.put(`/employees/${employee.id}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save employee profile');
    } finally {
      setLoading(false);
    }
  };

  const availableDepts = seriesList.length > 0 
    ? seriesList.map(s => ({ id: s.dept_id, name: s.dept_name, series: s.series_prefix, count: s.emp_count }))
    : departments.map(d => ({ id: d.id, name: d.name, series: '', count: 0 }));

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {employee ? 'Edit Employee Profile' : 'Enroll New Employee'}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {employee ? `Updating code: ${employee.emp_code}` : 'Auto-allocated section series & comprehensive profile'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {isManager && (
          <div style={{ 
            background: 'rgba(234, 179, 8, 0.12)', 
            border: '1px solid rgba(234, 179, 8, 0.35)', 
            borderRadius: '10px', 
            padding: '10px 14px', 
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
            color: 'var(--warning-color, #eab308)'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Manager Notice:</strong> Enrolled employees and basic salary figures will be submitted to the <strong>Admin for Approval</strong> before payroll release.
            </span>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '13px', marginBottom: '14px', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section Selection */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Department / Section *
            </label>
            <select
              className="form-input"
              value={formData.dept_id}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              required
            >
              <option value="">-- Choose Existing Section --</option>
              {availableDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.series ? `[Allocated Series: ${d.series}] (${d.count} staff)` : ''}
                </option>
              ))}
            </select>
            {currentSeries && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--accent-primary)' }}>
                <Sparkles size={14} />
                <span>
                  Allocated Series: <strong>{currentSeries.series_prefix}</strong> &bull; Next Available Code: <strong>{currentSeries.next_suggested_code}</strong>
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label">Employee Code *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.emp_code}
                onChange={(e) => setFormData({ ...formData, emp_code: e.target.value.toUpperCase() })}
                placeholder="e.g. 18038"
                style={{ fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Raman Sharma"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label">Job Role / Designation</label>
              <input
                type="text"
                className="form-input"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Operator / Supervisor"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Joining Date (For 1-Year Increment)</label>
              <input
                type="date"
                className="form-input"
                value={formData.joining_date}
                onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              />
            </div>
          </div>

          {/* Basic Salary Section: Hidden/Disabled when Manager is Editing an Existing Employee */}
          {isManager && employee ? (
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '10px',
              padding: '12px 14px',
              border: '1px dashed var(--border-color)',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <span>🔒 <strong>Salary Protected:</strong> Individual salary figures and terms are managed exclusively by Admin.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">
                  Monthly Basic Salary (₹) {isManager ? '(Pending Admin Approval)' : ''}
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.basic_salary}
                  onChange={(e) => handleSalaryChange(e.target.value)}
                  placeholder="30000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Salary Per Day (Auto /30)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.salary_per_day}
                  onChange={(e) => setFormData({ ...formData, salary_per_day: e.target.value })}
                  placeholder="1000"
                />
              </div>
            </div>
          )}

          {/* Contact Details: Phone, Address, Status */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: '12px', 
            padding: '12px 14px', 
            border: '1px solid var(--border-color)', 
            marginBottom: '14px' 
          }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={14} color="var(--accent-primary)" /> Contact & Residential Information
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee Status</label>
                <select
                  className="form-input"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active (On Duty)</option>
                  <option value="inactive">Inactive (Temporary Hold)</option>
                  <option value="resigned">Resigned (Relieved)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Residential Address / City / Village</label>
              <textarea
                className="form-input"
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Village / Town, Ward / Street, Post Office..."
              />
            </div>
          </div>

          {/* Reference Mode Selection */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            borderRadius: '12px', 
            padding: '12px 14px', 
            border: '1px solid var(--border-color)', 
            marginBottom: '14px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} color="var(--accent-primary)" /> Reference / Recommendation
              </h4>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reference_type"
                    checked={formData.reference_type === 'none'}
                    onChange={() => setFormData(prev => ({ ...prev, reference_type: 'none' }))}
                  /> None
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reference_type"
                    checked={formData.reference_type === 'internal'}
                    onChange={() => setFormData(prev => ({ ...prev, reference_type: 'internal' }))}
                  /> Internal Staff
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reference_type"
                    checked={formData.reference_type === 'external'}
                    onChange={() => setFormData(prev => ({ ...prev, reference_type: 'external' }))}
                  /> Outside Contact
                </label>
              </div>
            </div>

            {formData.reference_type === 'internal' && (
              <div style={{ marginTop: '8px' }}>
                <SearchableEmployeeSelect
                  employees={allEmployees}
                  value={formData.referred_by_emp_id}
                  onChange={(id) => setFormData({ ...formData, referred_by_emp_id: id })}
                  label="Select Recommending Active Employee"
                  placeholder="Type Employee ID / Code or Name to search..."
                />
              </div>
            )}

            {formData.reference_type === 'external' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <div className="form-group">
                  <label className="form-label">External Person Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.referred_by_name}
                    onChange={(e) => setFormData({ ...formData, referred_by_name: e.target.value })}
                    placeholder="e.g. Sarpanch / Contractor..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.referred_by_phone}
                    onChange={(e) => setFormData({ ...formData, referred_by_phone: e.target.value })}
                    placeholder="+91..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Increment Rate Setting (Admin Only) */}
          {!isManager && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: '10px', padding: '10px 14px',
              border: '1px solid var(--border-color)', marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Annual Increment Rate (%)</label>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Tenure compound rate evaluated after 1-year mark
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.5"
                    className="form-input"
                    style={{ width: '80px', textAlign: 'center', fontWeight: 700 }}
                    value={formData.increment_rate}
                    onChange={(e) => setFormData({ ...formData, increment_rate: e.target.value })}
                  />
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>%</span>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Leave Quota / Allowed Leaves Policy (Admin Only) */}
          {!isManager && (
            <div style={{ 
              background: 'var(--bg-secondary)', 
              borderRadius: '12px', 
              padding: '12px 14px', 
              border: '1px solid var(--border-color)', 
              marginBottom: '16px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Palmtree size={14} color="var(--accent-primary)" /> Monthly Allowed Leave Quota (Paid Leaves)
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Annual: <strong>{(parseFloat(formData.monthly_leave_quota || '0') * 12).toFixed(1)} days/yr</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Permitted paid leaves per month. Unused leaves are eligible for encashment bonus, while excess absences incur standard salary deductions.
                  </span>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                    {['0.0', '1.0', '2.0', '3.0'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, monthly_leave_quota: preset }))}
                        style={{
                          padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '4px',
                          border: formData.monthly_leave_quota === preset ? '1px solid #0284c7' : '1px solid var(--border-color)',
                          background: formData.monthly_leave_quota === preset ? '#e0f2fe' : 'transparent',
                          color: formData.monthly_leave_quota === preset ? '#0369a1' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {preset === '2.0' ? '2.0d (Std)' : `${preset}d`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="31"
                    className="form-input"
                    style={{ width: '90px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}
                    value={formData.monthly_leave_quota}
                    onChange={(e) => setFormData({ ...formData, monthly_leave_quota: e.target.value })}
                    placeholder="2.0"
                  />
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '12px' }}>days/mo</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontWeight: 700 }}>
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Profile & Allocate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;
