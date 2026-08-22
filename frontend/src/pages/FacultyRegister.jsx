import React from 'react';
import { Link } from 'react-router-dom';
import RcpitLogo from '../components/RcpitLogo';
import { ShieldCheck, LogIn, Building, Info } from 'lucide-react';

export const FacultyRegister = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center animate-fade-in">
        <div className="flex justify-center">
          <RcpitLogo size="lg" />
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rcpit-900/80 border border-rcpit-700 text-rcpit-400 flex items-center justify-center mx-auto shadow-inner">
            <Building className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">Faculty Self-Registration Disabled</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              R. C. Patel Institute of Technology officially provisions Faculty credentials upon institutional onboarding. Self-registration inside ActivityTracker RCPIT is not permitted.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-rcpit-400 font-bold">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Official Credential Policy</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-normal">
              Please use your officially assigned Employee / Faculty ID or institutional email to log in. If you have not yet received your login credentials, please contact your Head of Department or RCPIT System Administration.
            </p>
          </div>

          <Link
            to="/login"
            className="w-full py-3.5 bg-gradient-to-r from-rcpit-600 to-rcpit-800 hover:from-rcpit-500 hover:to-rcpit-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all"
          >
            <LogIn className="w-4 h-4" /> Return to Institutional Login
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 font-semibold">
          © 2026 ActivityTracker RCPIT — Official Institutional Access Control
        </p>
      </div>
    </div>
  );
};

export default FacultyRegister;
