import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Search, X, Calendar, FileText, User, Building, ArrowRight } from 'lucide-react';

export const GlobalSearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ activities: [], users: [], departments: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ activities: [], users: [], departments: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [actRes, userRes, deptRes] = await Promise.all([
          api.get(`/activities?search=${query}`),
          api.get(`/users?search=${query}`),
          api.get(`/departments`)
        ]);

        const filteredDepts = (deptRes.departments || []).filter(d =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.code.toLowerCase().includes(query.toLowerCase())
        );

        setResults({
          activities: (actRes.activities || []).slice(0, 5),
          users: (userRes.users || []).slice(0, 5),
          departments: filteredDepts.slice(0, 3)
        });
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Search Input Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-rcpit-600 dark:text-rcpit-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search activities, departments, faculty, documents..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Searching institutional records...</div>
          ) : !query ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Type anything to search across RCPIT activities, departments, and faculty.
            </div>
          ) : results.activities.length === 0 && results.users.length === 0 && results.departments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No institutional matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Activities Results */}
              {results.activities.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Activities ({results.activities.length})
                  </h5>
                  <div className="space-y-1.5">
                    {results.activities.map((act) => (
                      <div
                        key={act._id}
                        onClick={() => {
                          navigate(`/faculty/activities/${act._id}`);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-rcpit-50 dark:hover:bg-rcpit-950/40 border border-transparent hover:border-rcpit-200 dark:hover:border-rcpit-800 cursor-pointer flex items-center justify-between transition-all group"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-rcpit-600 dark:group-hover:text-rcpit-400">
                            {act.title}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {act.category} • {act.departmentId?.name || 'Department'} • {new Date(act.date).toLocaleDateString()}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departments Results */}
              {results.departments.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Academic Departments ({results.departments.length})
                  </h5>
                  <div className="space-y-1.5">
                    {results.departments.map((dept) => (
                      <div
                        key={dept._id}
                        onClick={() => {
                          navigate(`/admin/departments`);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <span>{dept.name} ({dept.code})</span>
                        {dept.performanceScore !== undefined && dept.performanceScore !== null && (
                          <span className="text-[10px] text-rcpit-600 font-bold">Performance: {dept.performanceScore}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Results */}
              {results.users.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Faculty & Staff ({results.users.length})
                  </h5>
                  <div className="space-y-1.5">
                    {results.users.map((u) => (
                      <div
                        key={u._id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{u.name}</p>
                          <p className="text-[10px] text-slate-500">{u.designation} • {u.role} ({u.employeeId})</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                          {u.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Press ESC or click close to exit search</span>
          <span>CTRL + K Command Palette</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
