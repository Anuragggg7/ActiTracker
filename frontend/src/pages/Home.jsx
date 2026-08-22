import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import RcpitLogo from '../components/RcpitLogo';
import Prism from '../components/Prism';
import {
  ShieldCheck,
  FileText,
  BarChart3,
  Sun,
  Moon,
  ArrowRight,
  Building2,
  GraduationCap,
  MapPin,
  LogIn,
  Mail,
  Phone,
  Calendar,
  FileCheck,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Starfield Canvas Background Component
const ParticleBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(90, Math.floor(width / 16));
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.5,
        color: ['#a855f7', '#6366f1', '#38bdf8', '#ffffff'][Math.floor(Math.random() * 4)],
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.7 + 0.3,
        pulseSpeed: Math.random() * 0.02 + 0.005
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background ambient radial glow
      const grad1 = ctx.createRadialGradient(width * 0.5, 0, 0, width * 0.5, 0, width * 0.6);
      grad1.addColorStop(0, 'rgba(124, 58, 237, 0.12)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.01;
        p.alpha = Math.max(0.2, Math.min(0.9, p.alpha));

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 110) * 0.15;
            ctx.strokeStyle = '#818cf8';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw line to mouse if close
        const mdx = p.x - mouseX;
        const mdy = p.y - mouseY;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 140) {
          ctx.save();
          ctx.globalAlpha = (1 - mdist / 140) * 0.35;
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseX, mouseY);
          ctx.stroke();
          ctx.restore();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
};

export default function Home() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const getDashboardRoute = (role) => {
    switch (role) {
      case 'FACULTY':
        return '/faculty';
      case 'HOD':
        return '/hod';
      case 'TP':
        return '/tp';
      case 'DIRECTOR':
        return '/director';
      case 'ADMIN':
        return '/admin';
      default:
        return '/faculty';
    }
  };

  // Real Project Features strictly matching ActivityTracker RCPIT architecture
  const realProjectFeatures = [
    {
      id: 'approval',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      badge: 'RBAC Workflow',
      badgeStyle: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
      title: '5-Tier Institutional Approval Workflow',
      description:
        'Sequential approval routing from Faculty Proposals → HOD Verification → Admin Slot Booking → Director Executive Oversight.'
    },
    {
      id: 'venue',
      icon: Calendar,
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      badge: 'Conflict Prevention',
      badgeStyle: 'bg-purple-950/80 text-purple-400 border-purple-800/60',
      title: 'Conflict-Free Venue & Slot Allocation',
      description:
        'Centralized slot reservation for Main Auditoriums, Seminar Halls, and Computer Labs with real-time schedule collision prevention.'
    },
    {
      id: 'verification',
      icon: FileCheck,
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      badge: 'Audit Readiness',
      badgeStyle: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
      title: 'Post-Event Verification & Media Repository',
      description:
        'Upload participant attendance sheets, event posters, media photos, and budget summaries with automated completeness scoring.'
    },
    {
      id: 'naac',
      icon: FileText,
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      badge: 'Accreditation Stream',
      badgeStyle: 'bg-blue-950/80 text-blue-400 border-blue-800/60',
      title: 'Automated One-Click NAAC/NBA PDF Generator',
      description:
        'Instant creation of comprehensive, official activity reports with verification badges and financial breakdowns for inspection visits.'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      iconBg: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      badge: 'Executive Insight',
      badgeStyle: 'bg-pink-950/80 text-pink-400 border-pink-800/60',
      title: 'Departmental Analytics & Director Monitoring',
      description:
        'Real-time executive tracking of activity metrics, department participation, venue utilization, and academic events.'
    },
    {
      id: 'security',
      icon: Lock,
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      badge: 'Immutable Security',
      badgeStyle: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
      title: 'Immutable System Audit Trail & Isolation',
      description:
        'Cryptographically logged system activity trail providing strict departmental boundaries and governance security.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-slate-100 font-sans selection:bg-purple-600 selection:text-white relative overflow-x-hidden transition-colors duration-300">
      {/* Particle Canvas Background */}
      <ParticleBackground />

      {/* WebGL 3D Prism Animation Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40 dark:opacity-50 overflow-hidden">
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0.5}
          glow={1}
        />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0b0e]/80 border-b border-slate-800/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group" title="ActiTracker RCPIT Homepage">
            <RcpitLogo size="md" />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#hero" className="hover:text-purple-400 transition-colors">
              Home
            </a>
            <a href="#features" className="hover:text-purple-400 transition-colors">
              Key Features
            </a>
            <a href="#about" className="hover:text-purple-400 transition-colors">
              About Us
            </a>
            <a href="#contact" className="hover:text-purple-400 transition-colors">
              Contact Us
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 text-xs font-semibold backdrop-blur-md transition-all active:scale-95 shadow-inner cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {user ? (
              <button
                onClick={() => navigate(getDashboardRoute(user.role))}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Dashboard ({user.role})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rcpit-600 text-white font-bold text-sm shadow-lg shadow-purple-600/30 hover:scale-[1.03] active:scale-[0.98] transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Portal Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 z-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Floating Top Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs sm:text-sm font-medium backdrop-blur-xl shadow-lg shadow-purple-950/50 mb-8"
        >
          <Building2 className="w-4 h-4 text-purple-400" />
          <span>Official Institutional Activity Management System | RCPIT Shirpur</span>
        </motion.div>

        {/* Main Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-white max-w-5xl mx-auto"
        >
          Centralized Campus Activity & Event Management Portal
        </motion.h1>

        {/* Hero Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal"
        >
          Empowering R. C. Patel Institute of Technology with real-time activity proposals, conflict-free venue slot allocation, multi-tier HOD approvals, and automated NAAC/NBA audit PDF reports.
        </motion.p>

        {/* Hero CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6"
        >
          <Link
            to="/login"
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-rcpit-600 text-white font-bold text-base shadow-xl shadow-purple-600/35 hover:shadow-purple-600/60 hover:scale-105 active:scale-95 transition-all group"
          >
            <span>Sign In to Institutional Portal</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-slate-900/90 border border-slate-700/90 text-slate-200 hover:text-white hover:bg-slate-800/90 hover:border-slate-500 font-bold text-base backdrop-blur-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <span>Explore Key Features</span>
          </a>
        </motion.div>

        {/* Dynamic Key Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
        >
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400">100%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Conflict-Free Venues</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">5-Tier</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Approval Engine</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">NAAC / NBA</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Audit PDF Generator</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">0–100%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Report Quality Score</div>
          </div>
        </motion.div>
      </section>

      {/* Core Key Features Section */}
      <section id="features" className="py-20 z-10 relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-bold tracking-wider uppercase mb-4 shadow-sm">
            PROJECT SYSTEM CAPABILITIES
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Key Features of ActivityTracker RCPIT
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            Tailored specifically for R. C. Patel Institute of Technology to track workshops, seminars, hackathons, FDPs, and placement drives with full audit compliance.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {realProjectFeatures.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-3xl bg-slate-900/70 border border-slate-800/90 p-8 backdrop-blur-xl hover:border-purple-500/40 hover:bg-slate-900/90 transition-all duration-300 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={`p-3.5 rounded-2xl border ${item.iconBg} shadow-inner`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${item.badgeStyle}`}>
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-20 z-10 relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-xs font-bold tracking-wider uppercase mb-4 shadow-sm">
            ABOUT OUR INSTITUTION
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            R. C. Patel Institute of Technology, Shirpur
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            An Autonomous Engineering Institute accredited with NAAC Grade 'A', dedicated to academic excellence, innovation, and digital governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4 hover:border-purple-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Academic Innovation</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Offering premier undergraduate and postgraduate engineering programs across AIML, Data Science, Computer Engineering, IT, E&TC, Civil, Mechanical, and Electrical disciplines.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4 hover:border-cyan-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Digital Governance</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              ActiTracker provides a unified institutional portal to streamline activity proposals, venue reservations, multi-tier HOD approvals, and automated NAAC PDF reports.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl space-y-4 hover:border-emerald-500/40 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Multi-Tier RBAC</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Role-based access controls enforcing isolation across Faculty, Department Heads, T&P Officers, System Administrator, and Director executive dashboards.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-20 z-10 relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold tracking-wider uppercase mb-4 shadow-sm">
            GET IN TOUCH WITH US
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Contact Institutional Support
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
            Have questions regarding portal access, venue reservations, or department activity tracking? We are here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Details Cards */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex items-start gap-4 hover:border-purple-500/40 transition-all">
              <div className="p-3.5 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Campus Location</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  R. C. Patel Institute of Technology, Near Nimzari Naka, Shahada Road, Shirpur, Dist. Dhule, Maharashtra - 425405, India.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex items-start gap-4 hover:border-cyan-500/40 transition-all">
              <div className="p-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Institutional Support Desk</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Email: <span className="text-white font-semibold">support@rcpit.ac.in</span> | <span className="text-white font-semibold">principal@rcpit.ac.in</span>
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex items-start gap-4 hover:border-emerald-500/40 transition-all">
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Telephone Desk</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Phone: <span className="text-white font-semibold">+91 2563 259802 / 259803</span> | Fax: <span className="text-white font-semibold">+91 2563 259801</span>
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form Card */}
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-2xl shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white">Send Support Enquiry</h3>
            <p className="text-xs text-slate-400">Fill in your information to receive official assistance from RCPIT System Administration.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); alert('Thank you! Your enquiry has been received by RCPIT Support Desk.'); }} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">Your Name</label>
                <input type="text" required placeholder="Prof. Nilesh Patil" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">Official Email</label>
                <input type="email" required placeholder="nilesh.patil@rcpit.ac.in" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">Message / Inquiry</label>
                <textarea rows={3} required placeholder="Describe your query regarding activity tracking or portal access..." className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"></textarea>
              </div>

              <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer">
                Send Enquiry
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-20 z-10 relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-slate-900/90 border border-purple-500/30 p-8 sm:p-12 text-center relative overflow-hidden backdrop-blur-2xl shadow-2xl">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight text-white">
            Ready to Streamline Campus Activity Tracking?
          </h2>
          <p className="mt-4 text-base sm:text-xl text-purple-100/90 max-w-2xl mx-auto font-medium">
            Experience conflict-free venue booking, automated NAAC/NBA reports, and 5-tier approval workflows today.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/login"
              className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-purple-950 font-extrabold text-base shadow-2xl hover:bg-purple-50 hover:scale-105 active:scale-95 transition-all"
            >
              <span>Access Institutional Portal</span>
              <ArrowRight className="w-5 h-5 text-purple-950" />
            </Link>
          </div>
        </div>
      </section>

      {/* Sleek Footer */}
      <footer className="py-12 z-10 relative border-t border-slate-800/80 bg-[#07080a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <RcpitLogo size="sm" />
          </div>

          <div className="text-xs text-slate-400 text-center font-medium">
            © 2026 ActivityTracker RCPIT. All Rights Reserved.
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="#features" className="hover:text-purple-400 transition-colors">
              Key Features
            </a>
            <a href="#about" className="hover:text-purple-400 transition-colors">
              About Us
            </a>
            <a href="#contact" className="hover:text-purple-400 transition-colors">
              Contact Us
            </a>
            <Link to="/login" className="hover:text-purple-400 transition-colors">
              Portal Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
