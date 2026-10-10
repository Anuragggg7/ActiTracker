import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import GlobalSearchModal from './components/GlobalSearchModal';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import FacultyDashboard from './pages/FacultyDashboard';
import HodDashboard from './pages/HodDashboard';
import TpDashboard from './pages/TpDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ActivityDetail from './pages/ActivityDetail';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import SlotManagement from './pages/SlotManagement';
import CentralCalendar from './pages/CentralCalendar';
import AuditLogs from './pages/AuditLogs';
import MediaCenter from './pages/MediaCenter';
import NotificationsView from './pages/NotificationsView';
import PublicNotifications from './pages/PublicNotifications';

import Home from './pages/Home';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold text-xs">
        Authenticating RCPIT Portal User...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to proper role dashboard
    const defaultRouteMap = {
      FACULTY: '/faculty',
      HOD: '/hod',
      TP: '/tp',
      DIRECTOR: '/director',
      ADMIN: '/admin'
    };
    return <Navigate to={defaultRouteMap[user.role] || '/login'} replace />;
  }

  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Home />;

  const routeMap = {
    FACULTY: '/faculty',
    HOD: '/hod',
    TP: '/tp',
    DIRECTOR: '/director',
    ADMIN: '/admin'
  };
  return <Navigate to={routeMap[user.role] || '/login'} replace />;
};

const MainLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const isHomePage = location.pathname === '/';

  if (isAuthPage || (isHomePage && !user)) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      <Navbar onOpenSearch={() => setIsSearchOpen(true)} />
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 gap-6">
        {user && <Sidebar />}
        <main className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
          <footer className="py-6 text-center">
            <div className="inline-block px-6 py-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-md text-xs font-bold text-slate-600 dark:text-slate-400">
              © 2026 ActiTracker. All Rights Reserved.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <Router>
            <MainLayout>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />

                {/* Role Specific Dashboards */}
                <Route
                  path="/faculty"
                  element={
                    <ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}>
                      <FacultyDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/hod"
                  element={
                    <ProtectedRoute allowedRoles={['HOD', 'ADMIN']}>
                      <HodDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/tp"
                  element={
                    <ProtectedRoute allowedRoles={['TP', 'ADMIN']}>
                      <TpDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/director"
                  element={
                    <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN']}>
                      <DirectorDashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Dedicated Sidebar Feature Pages */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'HOD', 'DIRECTOR']}>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/departments"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'HOD', 'DIRECTOR']}>
                      <DepartmentManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/slots"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'HOD', 'FACULTY', 'TP']}>
                      <SlotManagement />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <CentralCalendar />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/audit-logs"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
                      <AuditLogs />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/media-center"
                  element={
                    <ProtectedRoute>
                      <MediaCenter />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsView />
                    </ProtectedRoute>
                  }
                />
                <Route path="/public-notifications" element={<PublicNotifications />} />

                {/* Detailed Activity & Event Views (Requirement 3 & 4) */}
                <Route
                  path="/events/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/activities/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/faculty/activities/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hod/activities/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tp/activities/:id"
                  element={
                    <ProtectedRoute>
                      <ActivityDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Convenient Aliases for Refresh & Deep Links */}
                <Route path="/events" element={<RootRedirect />} />
                <Route path="/activities" element={<RootRedirect />} />
                <Route path="/slots" element={<ProtectedRoute><SlotManagement /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
                <Route path="/departments" element={<ProtectedRoute><DepartmentManagement /></ProtectedRoute>} />

                {/* Central Root Redirect */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="*" element={<RootRedirect />} />
              </Routes>
            </MainLayout>
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
