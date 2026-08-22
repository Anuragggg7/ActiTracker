import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Calendar, FileText, CheckSquare, Image as ImageIcon,
  Users, Building, Clock, ShieldAlert, BarChart3, Award, Layers, AlertCircle
} from 'lucide-react';

export const Sidebar = () => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const navItemsByRole = {
    FACULTY: [
      { to: '/faculty', label: 'My Activities', icon: LayoutDashboard },
      { to: '/calendar', label: 'Institutional Calendar', icon: Calendar },
      { to: '/media-center', label: 'My Media Center', icon: ImageIcon },
      { to: '/notifications', label: 'Notifications', icon: AlertCircle }
    ],
    HOD: [
      { to: '/hod', label: 'Department Overview', icon: LayoutDashboard },
      { to: '/admin/users', label: 'Department Faculty', icon: Users },
      { to: '/calendar', label: 'Department Calendar', icon: Calendar },
      { to: '/media-center', label: 'Department Media', icon: ImageIcon },
      { to: '/notifications', label: 'Notifications', icon: AlertCircle }
    ],
    TP: [
      { to: '/tp', label: 'T&P Drives & Activities', icon: LayoutDashboard },
      { to: '/calendar', label: 'T&P Calendar', icon: Calendar },
      { to: '/media-center', label: 'T&P Media Repository', icon: ImageIcon },
      { to: '/notifications', label: 'Notifications', icon: AlertCircle }
    ],
    DIRECTOR: [
      { to: '/director', label: 'Institutional Overview', icon: LayoutDashboard },
      { to: '/calendar', label: 'Institutional Calendar', icon: Calendar },
      { to: '/media-center', label: 'Institutional Media', icon: ImageIcon },
      { to: '/audit-logs', label: 'System Audit Logs', icon: Clock },
      { to: '/notifications', label: 'Notifications', icon: AlertCircle }
    ],
    ADMIN: [
      { to: '/admin', label: 'System Control Panel', icon: LayoutDashboard },
      { to: '/admin/users', label: 'User Account Management', icon: Users },
      { to: '/admin/departments', label: 'Department & HOD Mgmt', icon: Building },
      { to: '/admin/slots', label: 'Slot & Venue Management', icon: Clock },
      { to: '/calendar', label: 'Central Calendar', icon: Calendar },
      { to: '/audit-logs', label: 'System Audit Trail', icon: ShieldAlert },
      { to: '/media-center', label: 'Media Repository', icon: ImageIcon }
    ]
  };

  const navItems = navItemsByRole[role] || [];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        {/* Role Badge Indicator */}
        <div className="px-3 py-2.5 rounded-xl bg-rcpit-50 dark:bg-slate-800 border border-rcpit-100 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rcpit-600 text-white shadow-sm">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-wider text-rcpit-600 dark:text-rcpit-400">
              Role Workspace
            </p>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {role === 'TP' ? 'T&P Cell' : role} Portal
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/faculty' || item.to === '/hod' || item.to === '/tp' || item.to === '/director' || item.to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-rcpit-600 text-white shadow-md shadow-rcpit-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Institutional Footer */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        <p className="font-bold text-slate-700 dark:text-slate-300">ActiTracker</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Version 1.0.0 Enterprise</p>
      </div>
    </aside>
  );
};

export default Sidebar;
