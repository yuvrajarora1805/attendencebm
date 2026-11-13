import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Trash2, Plus, Edit2, Layers, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface SectionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const SectionManagerModal: React.FC<SectionManagerModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSection, setEditingSection] = useState<any | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [codeStart, setCodeStart] = useState('');
  const [codeEnd, setCodeEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadSections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/series-info');
      setSections(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load sections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSections();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingSection(null);
    setName('');
    setDescription('');
    setCodeStart('');
    setCodeEnd('');
    setMessage(null);
  };

  const handleEditClick = (sec: any) => {
    setEditingSection(sec);
    setName(sec.dept_name);
    setDescription(sec.description || '');
    setCodeStart(sec.code_start ? String(sec.code_start) : '');
    setCodeEnd(sec.code_end ? String(sec.code_end) : '');
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (codeStart && codeEnd && parseInt(codeStart) > parseInt(codeEnd)) {
      setMessage({ type: 'error', text: 'Series Start Code cannot be greater than End Code' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        code_start: codeStart ? parseInt(codeStart) : null,
        code_end: codeEnd ? parseInt(codeEnd) : null,
      };

      if (editingSection) {
        await api.put(`/employees/departments/${editingSection.dept_id}`, payload);
        setMessage({ type: 'success', text: `Section "${name}" updated successfully!` });
      } else {
        await api.post('/employees/departments', payload);
        setMessage({ type: 'success', text: `Section "${name}" created with series range ${codeStart || 'Auto'} - ${codeEnd || 'Auto'}!` });
      }

      resetForm();
      loadSections();
      onUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save section' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sec: any) => {
    if (!confirm(`Are you sure you want to remove section "${sec.dept_name}"?`)) return;
    try {
      await api.delete(`/employees/departments/${sec.dept_id}`);
      setMessage({ type: 'success', text: `Section "${sec.dept_name}" deleted.` });
      loadSections();
      onUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete section' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '820px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Section & Series Allocation Manager</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Create or rename sections & specify allocated code series range (e.g. 2000 - 2050)
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {message && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '16px',
            background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: message.type === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
            color: message.type === 'success' ? '#10b981' : '#ef4444'
          }}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
          {/* Left Form: Create / Edit Section */}
          <form onSubmit={handleSave} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              {editingSection ? `Edit: ${editingSection.dept_name}` : '➕ Create New Section'}
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Section / Department Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. PACKING B, BOILER 2"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Series Start Code</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 2000"
                  value={codeStart}
                  onChange={e => setCodeStart(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Series End Code</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 2050"
                  value={codeEnd}
                  onChange={e => setCodeEnd(e.target.value)}
                />
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginBottom: '14px' }}>
              💡 Example: Setting <strong>2000 - 2050</strong> will automatically allocate codes between 2000 and 2050 when adding staff to this section.
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '11px' }}>Notes / Description (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Morning Shift Plant"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editingSection && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={resetForm} style={{ flex: 1, padding: '8px', fontSize: '12px' }}>
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-danger" 
                    onClick={() => handleDelete(editingSection)}
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                    title="Delete this section"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1.5, padding: '8px', fontSize: '12px', fontWeight: 700 }}>
                <Save size={14} />
                {saving ? 'Saving...' : editingSection ? 'Update Section' : 'Create Section'}
              </button>
            </div>
          </form>

          {/* Right Column: Existing Sections List */}
          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Existing Sections ({sections.length})</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click Edit to change name or series</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sections.map(sec => (
                <div key={sec.dept_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {sec.dept_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Allocated Series: <strong style={{ color: 'var(--accent-primary)' }}>{sec.series_prefix}</strong> &bull; Next Code: <strong>{sec.next_suggested_code}</strong> ({sec.emp_count} staff)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => handleEditClick(sec)}
                      title="Edit Section Name & Series Range"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    {sec.emp_count === 0 && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => handleDelete(sec)}
                        title="Delete empty section"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SectionManagerModal;
