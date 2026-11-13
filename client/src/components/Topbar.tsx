import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, Shield, Sun, Moon, Menu } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle, actions }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<string>(() => {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) return saved === 'true';
    return window.innerWidth < 1366;
  });

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
    if (next) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <button
          className="btn btn-secondary"
          onClick={toggleSidebar}
          style={{ padding: '6px 9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar for wider view'}
        >
          <Menu size={16} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 className="topbar-title">{title}</h1>
          {subtitle && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>}
        </div>
      </div>

      <div className="topbar-right">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to White & Blue Light Mode' : 'Switch to Black & Blue Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={14} color="#fbbf24" /> : <Moon size={14} color="#0284c7" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <div className="topbar-badge-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Calendar size={15} />
          <span>{today}</span>
        </div>

        <div className="badge badge-success topbar-badge-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
          <span className="pulse-dot"></span>
          <span>Live Connected</span>
        </div>

        <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Shield size={12} />
          <span style={{ textTransform: 'uppercase', fontSize: '11px' }}>{user?.role}</span>
        </div>

        {actions && <div className="topbar-actions-wrapper">{actions}</div>}
      </div>
    </header>
  );
};

export default Topbar;
