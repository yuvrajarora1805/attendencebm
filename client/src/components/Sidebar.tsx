import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, CalendarCheck, Banknote,
  FileSpreadsheet, ShieldAlert, Database,
  UserCog, LogOut, CheckSquare
} from 'lucide-react';

interface NavEntry {
  path: string;
  label: string;
  icon: any;
  roles: string[];
}

const navItems: { section: string; items: NavEntry[] }[] = [
  {
    section: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'hr', 'payroll', 'viewer'] },
    ]
  },
  {
    section: 'Operations',
    items: [
      { path: '/manager', label: 'Manager Attendance', icon: CalendarCheck, roles: ['admin', 'manager', 'hr'] },
      { path: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'manager'] },
      { path: '/attendance', label: 'Attendance (All)', icon: CalendarCheck, roles: ['admin', 'hr', 'payroll'] },
      { path: '/advances', label: 'Advances & Loans', icon: Banknote, roles: ['admin', 'hr', 'payroll', 'manager'] },
      { path: '/salary', label: 'Salary Sheet', icon: Banknote, roles: ['admin', 'payroll'] },
      { path: '/reports', label: 'Reports & Export', icon: FileSpreadsheet, roles: ['admin', 'hr', 'payroll'] },
    ]
  },
  {
    section: 'Data & Security',
    items: [
      { path: '/data-control', label: 'Data Control', icon: ShieldAlert, roles: ['admin'] },
      { path: '/backup', label: 'Backup & Restore', icon: Database, roles: ['admin'] },
      { path: '/users', label: 'User Roles', icon: UserCog, roles: ['admin'] },
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon"><CheckSquare size={20} color="#fff" /></div>
        <div className="logo-text">
          AttendPro
          <span>Workforce & Payroll</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((sec) => {
          const visibleItems = sec.items.filter(item => hasRole(...item.roles));
          if (!visibleItems.length) return null;

          return (
            <div key={sec.section} className="nav-section">
              <div className="nav-section-label">{sec.section}</div>
              {visibleItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '14px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div className="sidebar-user-text" style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name || user?.username}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              {user?.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '6px 8px', flexShrink: 0 }}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
