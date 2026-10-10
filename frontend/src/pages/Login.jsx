import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import RcpitLogo from '../components/RcpitLogo';
import { 
  LogIn, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Shield, 
  Mail, 
  Lock, 
  Sun, 
  Moon
} from 'lucide-react';

export const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);

  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await login(identifier, password);
      if (res.success) {
        const authUser = res.user || res.data?.user;
        showToast(`Welcome back, ${authUser.name}!`, 'success');
        
        // Automatic role-based dashboard routing from backend user object
        const role = authUser.role;
        if (role === 'FACULTY') navigate('/faculty');
        else if (role === 'HOD') navigate('/hod');
        else if (role === 'TP') navigate('/tp');
        else if (role === 'DIRECTOR') navigate('/director');
        else if (role === 'ADMIN') navigate('/admin');
        else navigate('/');
      } else {
        setErrorMsg(res.message || 'Invalid Employee ID/email or password.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid Employee ID/email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-x-hidden font-sans transition-colors duration-300">
      
      {/* Glassmorphic Background Abstract Texture & Ambient Glow Streaks */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-400/20 via-indigo-600/10 to-transparent blur-2xl"></div>
      <div className="absolute top-10 -left-20 w-96 h-96 bg-indigo-500/25 dark:bg-indigo-600/30 rounded-full blur-3xl pointer-events-none transition-all duration-500"></div>
      <div className="absolute bottom-10 -right-20 w-96 h-96 bg-purple-500/25 dark:bg-purple-600/30 rounded-full blur-3xl pointer-events-none transition-all duration-500"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-amber-500/15 dark:bg-rcpit-500/15 rounded-full blur-3xl pointer-events-none transition-all duration-500"></div>

      {/* Static Ambient Glow Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-rcpit-500/10 rounded-full blur-3xl opacity-50 dark:opacity-60" />
        <div className="absolute bottom-0 right-0 w-[25rem] h-[25rem] bg-gradient-to-tl from-purple-500/15 to-transparent rounded-full blur-3xl opacity-40 dark:opacity-50" />
      </div>

      {/* Floating Glassy Top Header Navigation Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between z-20 py-3 px-4 sm:px-6 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-xl transition-all duration-300">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity" title="Go to Homepage">
          <RcpitLogo size="md" />
        </Link>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className="px-4 py-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow-md backdrop-blur-md flex items-center gap-2 text-xs font-extrabold transition-all duration-200 active:scale-95 cursor-pointer"
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content Area - Frosted Glass Login Card */}
      <main className="w-full max-w-md my-auto relative z-10 py-6 animate-fade-in">
        
        {/* Sleek Frosted Translucent Glass Card */}
        <div className="p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] space-y-6 border border-white/40 dark:border-white/10 bg-white/35 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[32px] transition-all duration-300 hover:border-white/60 dark:hover:border-white/20 group">
          
          {/* Card Top Title & Subtitle */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome Back
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/80 font-medium">
              Sign in to your ActivityTracker RCPIT account
            </p>
          </div>

          {/* Interactive Error Alert Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-fade-in backdrop-blur-md shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Single Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            
            {/* Input 1: Email Address or Employee ID */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <div 
                className={`relative rounded-xl border bg-white/40 dark:bg-slate-950/50 backdrop-blur-md transition-all duration-200 shadow-sm ${
                  focusedInput === 'identifier'
                    ? 'border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20'
                }`}
              >
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                  focusedInput === 'identifier' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`} />
                <input
                  type="text"
                  required
                  value={identifier}
                  onFocus={() => setFocusedInput('identifier')}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or employee ID"
                  className="w-full pl-10 pr-4 py-3 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 outline-none font-semibold transition-colors"
                />
              </div>
            </div>

            {/* Input 2: Password */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div 
                className={`relative rounded-xl border bg-white/40 dark:bg-slate-950/50 backdrop-blur-md transition-all duration-200 shadow-sm ${
                  focusedInput === 'password'
                    ? 'border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-md'
                    : 'border-white/40 dark:border-white/10 hover:border-white/60 dark:hover:border-white/20'
                }`}
              >
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                  focusedInput === 'password' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 outline-none font-semibold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Interactive Frosted Glass Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-rcpit-600 hover:from-indigo-500 hover:via-purple-500 hover:to-rcpit-500 border border-white/30 dark:border-white/20 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Authenticating Credentials...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>

          {/* Institutional Security Notice */}
          <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300/80 font-semibold">
            <Shield className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Official Institutional RBAC Authentication Protocol</span>
          </div>

        </div>
      </main>

      {/* Glassy Pill Footer */}
      <footer className="w-full text-center py-3 z-20">
        <div className="inline-block px-6 py-2.5 rounded-full bg-white/50 dark:bg-slate-900/50 border border-white/40 dark:border-white/10 backdrop-blur-2xl shadow-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all">
          © 2026 ActivityTracker RCPIT. All Rights Reserved.
        </div>
      </footer>

    </div>
  );
};

export default Login;
