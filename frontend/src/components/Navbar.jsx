import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api/client';
import RcpitLogo from './RcpitLogo';
import {
  Bell, Sun, Moon, Search, LogOut, KeyRound,
  Shield, CheckCircle2, ChevronDown, X, Lock
} from 'lucide-react';

export const Navbar = ({ onOpenSearch }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAllRead, showToast } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [submittingPass, setSubmittingPass] = useState(false);

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast('All password fields are required.', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('New password and confirm password do not match.', 'error');
      return;
    }

    try {
      setSubmittingPass(true);
      const res = await api.put('/auth/change-password', passwordForm);
      if (res.success) {
        showToast(res.message || 'Password changed successfully', 'success');
        setShowChangePasswordModal(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setSubmittingPass(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left Logo */}
        <Link to="/" className="hover:opacity-95 transition-opacity">
          <RcpitLogo size="md" />
        </Link>

        {/* Global Search Quick Trigger (Ctrl + K) */}
        {user && (
          <button
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-3 px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rcpit-400 dark:hover:border-rcpit-500 transition-all w-72 justify-between"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span>Search activities, docs, faculty...</span>
            </div>
            <kbd className="px-2 py-0.5 text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Right Action Icons & User Dropdown */}
        <div className="flex items-center gap-3">
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Toggle theme mode"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          {/* Notifications Popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-rcpit-600" /> Notifications
                  </h4>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-rcpit-600 dark:text-rcpit-400 hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Close Notifications"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto mt-2 space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        className={`p-3 rounded-xl text-xs transition-colors ${
                          n.isRead
                            ? 'bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                            : 'bg-rcpit-50/70 dark:bg-rcpit-950/40 border-l-4 border-rcpit-600 text-slate-900 dark:text-white font-medium'
                        }`}
                      >
                        <p className="font-bold mb-0.5">{n.title}</p>
                        <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rcpit-600 to-rcpit-800 text-white font-bold flex items-center justify-center text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-rcpit-600 dark:text-rcpit-400 font-semibold uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                    {user.employeeId && (
                      <p className="text-[10px] text-rcpit-600 dark:text-rcpit-400 font-mono font-bold mt-0.5">
                        ID: {user.employeeId}
                      </p>
                    )}
                  </div>

                  <Link
                    to="/notifications"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    <Bell className="w-4 h-4 text-slate-400" /> Notifications
                  </Link>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowChangePasswordModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium text-left"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" /> Change Password
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-medium mt-1"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-rcpit-600 hover:bg-rcpit-700 text-white font-medium text-xs rounded-xl shadow-md transition-all"
            >
              Institutional Login
            </Link>
          )}

        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" /> Change Password
              </h3>
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPass}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg"
                >
                  {submittingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
