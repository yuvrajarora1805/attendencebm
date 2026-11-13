import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import GuardPunchPage from './pages/GuardPunchPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import SalaryPage from './pages/SalaryPage';
import ReportsPage from './pages/ReportsPage';
import DataControlPage from './pages/DataControlPage';
import BackupPage from './pages/BackupPage';
import UsersPage from './pages/UsersPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import AdvancesPage from './pages/AdvancesPage';

import ManagerAttendancePage from './pages/ManagerAttendancePage';

const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

const ProtectedRoute: React.FC<{ allowedRoles?: string[] }> = ({ allowedRoles }) => {
  const { isAuthenticated, user, hasRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isGuard = user?.role === 'guard' || user?.role === 'security_guard';

  // If guard user tries to access general routes, keep them on /guard
  if (isGuard && window.location.pathname !== '/guard') {
    return <Navigate to="/guard" replace />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <Navigate to={user?.role === 'manager' ? '/manager' : '/dashboard'} replace />;
  }

  return <Outlet />;
};

export const App: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const isGuard = user?.role === 'guard' || user?.role === 'security_guard';
  const isManager = user?.role === 'manager';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? (
            isGuard ? <Navigate to="/guard" replace /> : 
            isManager ? <Navigate to="/manager" replace /> :
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        } />

        {/* Isolated Guard punch screen */}
        <Route element={<ProtectedRoute allowedRoles={['guard', 'security_guard', 'admin']} />}>
          <Route path="/guard" element={<GuardPunchPage />} />
        </Route>

        {/* Main Application with Sidebar */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to={isManager ? "/manager" : "/dashboard"} replace />} />
            
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'hr']} />}>
              <Route path="/manager" element={<ManagerAttendancePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'payroll', 'viewer']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'manager']} />}>
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/:id" element={<EmployeeProfilePage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'payroll', 'manager']} />}>
              <Route path="/advances" element={<AdvancesPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'payroll']} />}>
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin', 'payroll']} />}>
              <Route path="/salary" element={<SalaryPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/data-control" element={<DataControlPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
