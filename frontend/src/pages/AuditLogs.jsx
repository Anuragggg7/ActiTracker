import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Clock, Search, ShieldCheck, Filter, Download } from 'lucide-react';

export const AuditLogs = () => {
  const { showToast } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs');
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(l =>
    l.userName?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-rcpit-950 via-rcpit-900 to-rcpit-800 text-white shadow-xl">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800">
            System Compliance & Security
          </span>
          <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-400" /> System Audit Trail & Logs
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Immutable log trail of user authentication, activity submissions, status changes & administrative actions
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by user, action, entity, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <span className="text-slate-400 font-extrabold whitespace-nowrap">
          Total Logs: {filteredLogs.length}
        </span>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-card p-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading system audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No matching audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="pb-3 px-2">Timestamp</th>
                  <th className="pb-3 px-2">User / Role</th>
                  <th className="pb-3 px-2">Action Event</th>
                  <th className="pb-3 px-2">Target Entity</th>
                  <th className="pb-3 px-2">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-2 text-slate-500 font-medium whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-2 font-bold text-slate-900 dark:text-white">
                      <div>{log.userName || 'System'}</div>
                      <div className="text-[10px] text-rcpit-600 uppercase">{log.userRole}</div>
                    </td>
                    <td className="py-3.5 px-2 font-bold text-slate-800 dark:text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400">
                      {log.entity}
                    </td>
                    <td className="py-3.5 px-2 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.details || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AuditLogs;
