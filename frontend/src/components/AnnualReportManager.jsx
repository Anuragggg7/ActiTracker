import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import PDFViewerModal from './PDFViewerModal';
import {
  FileText, Calendar, CheckCircle2, AlertTriangle, Download, RefreshCw,
  Eye, ShieldCheck, Building2, Layers, Users, Award, Image as ImageIcon,
  Edit3, Check, X, ChevronDown, ChevronRight, BarChart2, Sparkles, BookOpen, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export const AnnualReportManager = ({ forcedDepartmentId = null }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const isHOD = user?.role === 'HOD';
  const isAdminOrDirector = ['ADMIN', 'DIRECTOR'].includes(user?.role);

  // Core State
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAY, setSelectedAY] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  
  // Readiness & Report State
  const [readinessData, setReadinessData] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [verifyingDraft, setVerifyingDraft] = useState(false);
  const [savingNarrative, setSavingNarrative] = useState(false);

  // Narrative Edit Form
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [narrativeForm, setNarrativeForm] = useState({
    executiveSummary: '',
    departmentOverview: '',
    annualConclusion: ''
  });

  // HOD Verification notes
  const [verificationNotes, setVerificationNotes] = useState('');

  // PDF Viewer Modal
  const [viewPdfUrl, setViewPdfUrl] = useState(null);

  // Tab View within Report Preview
  const [reportPreviewTab, setReportPreviewTab] = useState('overview'); // 'overview' | 'activities' | 'participation' | 'photos' | 'annexures'

  // Admin Overview State
  const [adminOverview, setAdminOverview] = useState(null);
  const [loadingAdminOverview, setLoadingAdminOverview] = useState(false);

  // Active Scope: 'DEPARTMENT' or 'INSTITUTIONAL'
  const isInstitutionalScope = isAdminOrDirector && selectedDeptId === 'INSTITUTIONAL';

  // 1. Initial Data Fetch (Academic Years & Departments)
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const ayRes = await api.get('/annual-reports/academic-years');
        if (ayRes.success) {
          setAcademicYears(ayRes.academicYears || []);
          setSelectedAY(ayRes.currentAcademicYear || ayRes.academicYears?.[0] || '2026–27');
        }

        if (isAdminOrDirector) {
          const deptRes = await api.get('/departments');
          if (deptRes.success) {
            setDepartments(deptRes.departments || []);
            // Default to first department or institutional
            setSelectedDeptId(forcedDepartmentId || deptRes.departments?.[0]?._id || 'INSTITUTIONAL');
          }
        } else if (isHOD) {
          const userDeptId = (user?.departmentId?._id || user?.departmentId)?.toString();
          setSelectedDeptId(userDeptId);
        }
      } catch (err) {
        console.error('Failed to initialize annual report manager:', err);
      }
    };

    fetchInit();
  }, [user, forcedDepartmentId]);

  // 2. Fetch Readiness / Existing Report whenever selection changes
  const fetchReportData = async () => {
    if (!selectedAY) return;

    // In HOD mode, ensure department is set
    const deptParam = isInstitutionalScope ? '' : (selectedDeptId || '');

    try {
      setLoadingReadiness(true);

      if (isInstitutionalScope) {
        // Fetch Admin Overview & Institutional Report
        const ovRes = await api.get(`/annual-reports/admin/overview?academicYear=${selectedAY}`);
        if (ovRes.success) {
          setAdminOverview(ovRes);
          if (ovRes.institutionalSummary?.institutionalReportId) {
            const repRes = await api.get(`/annual-reports/${ovRes.institutionalSummary.institutionalReportId}`);
            if (repRes.success) {
              setCurrentReport(repRes.report);
              setNarrativeForm(repRes.report.narrativeContent || {});
            }
          } else {
            setCurrentReport(null);
          }
        }
      } else if (deptParam) {
        const rRes = await api.get(`/annual-reports/readiness?departmentId=${deptParam}&academicYear=${selectedAY}`);
        if (rRes.success) {
          setReadinessData(rRes);
          if (rRes.existingReport) {
            setCurrentReport(rRes.existingReport);
            setNarrativeForm(rRes.existingReport.narrativeContent || {});
          } else {
            setCurrentReport(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load annual report data:', err);
    } finally {
      setLoadingReadiness(false);
    }
  };

  useEffect(() => {
    if (selectedAY && (selectedDeptId || isInstitutionalScope)) {
      fetchReportData();
    }
  }, [selectedAY, selectedDeptId]);

  // 3. Generate Draft
  const handleGenerateDraft = async () => {
    try {
      setGeneratingDraft(true);
      let res;
      if (isInstitutionalScope) {
        res = await api.post('/annual-reports/admin/consolidated/draft', { academicYear: selectedAY });
      } else {
        res = await api.post('/annual-reports/department/draft', {
          departmentId: selectedDeptId,
          academicYear: selectedAY
        });
      }

      if (res.success) {
        showToast(res.message || 'Draft compiled successfully', 'success');
        setCurrentReport(res.report);
        setNarrativeForm(res.report.narrativeContent || {});
        fetchReportData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to compile draft', 'error');
    } finally {
      setGeneratingDraft(false);
    }
  };

  // 4. Save Narrative Updates
  const handleSaveNarrative = async () => {
    if (!currentReport?._id) return;
    try {
      setSavingNarrative(true);
      const res = await api.patch(`/annual-reports/${currentReport._id}/narrative`, {
        narrativeContent: narrativeForm
      });
      if (res.success) {
        showToast('Report narrative updated successfully', 'success');
        setCurrentReport(res.report);
        setIsEditingNarrative(false);
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update narrative', 'error');
    } finally {
      setSavingNarrative(false);
    }
  };

  // 5. Verify Draft by HOD
  const handleVerifyReport = async () => {
    if (!currentReport?._id) return;
    try {
      setVerifyingDraft(true);
      const res = await api.patch(`/annual-reports/${currentReport._id}/verify`, {
        verificationNotes: verificationNotes || 'HOD verified and recommended for official institutional publication.'
      });
      if (res.success) {
        showToast(res.message || 'Annual report verified and endorsed by HOD', 'success');
        setCurrentReport(res.report);
        fetchReportData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Verification failed', 'error');
    } finally {
      setVerifyingDraft(false);
    }
  };

  // 6. Generate Official Publication PDF
  const handleGeneratePdf = async () => {
    if (!currentReport?._id) return;
    try {
      setGeneratingPdf(true);
      const res = await api.post(`/annual-reports/${currentReport._id}/generate-pdf`);
      if (res.success) {
        showToast(res.message || 'Official Annual Report PDF generated successfully', 'success');
        setCurrentReport(res.report);
        fetchReportData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'PDF Generation failed', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const readiness = readinessData?.readiness || {
    totalActivities: 0,
    totalConducted: 0,
    eligibleCount: 0,
    pendingVerificationCount: 0,
    missingReportsCount: 0,
    readinessScore: 0
  };

  const stats = currentReport?.statistics || {};
  const draftContent = currentReport?.draftContent || {};
  const categoryData = stats.categoryBreakdown ? Object.keys(stats.categoryBreakdown).map(k => ({
    name: k,
    count: stats.categoryBreakdown[k]
  })) : [];

  const COLORS = ['#0284c7', '#059669', '#d97706', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Top Banner & Selectors */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rcpit-950 via-rcpit-900 to-rcpit-800 text-white shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-800">
              Institutional Quality Assurance Cell (IQAC)
            </span>
            <h1 className="text-2xl font-extrabold mt-2 flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-400" />
              Annual Report Generator
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Automated compilation of HOD-verified department activities, attendance logs, photographic evidence, and documented outcomes.
            </p>
          </div>

          {/* Quick Refresh */}
          <button
            onClick={fetchReportData}
            disabled={loadingReadiness}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all self-start md:self-center flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingReadiness ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/10 text-xs">
          {/* Academic Year Dropdown */}
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" /> Academic Year:
            </label>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white font-bold outline-none focus:ring-2 focus:ring-amber-400"
            >
              {academicYears.map(ay => (
                <option key={ay} value={ay} className="bg-slate-900 text-white">
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Department Selector (Admin only) */}
          {isAdminOrDirector && (
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-300 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Scope / Department:
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-white font-bold outline-none focus:ring-2 focus:ring-cyan-400"
              >
                <option value="INSTITUTIONAL" className="bg-slate-900 text-amber-300 font-black">
                  ★ Consolidated Institutional Report (All Departments)
                </option>
                <optgroup label="Academic Departments" className="bg-slate-900 text-slate-400">
                  {departments.map(d => (
                    <option key={d._id} value={d._id} className="bg-slate-900 text-white font-medium">
                      {d.name} ({d.code})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* HOD Department Badge */}
          {isHOD && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Department:</span>
              <span className="bg-cyan-950 text-cyan-300 px-3 py-1 rounded-full font-extrabold border border-cyan-800">
                {user?.department?.name || 'Department'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* READINESS DASHBOARD (Section 11) */}
      {!isInstitutionalScope && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Annual Report Readiness & Verification Audit ({selectedAY})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Strict institutional criteria: Only activities with HOD-verified post-event reports are eligible for publication.
              </p>
            </div>

            {/* Overall Readiness Badge */}
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Readiness Score</span>
                <span className="text-lg font-black text-emerald-600">
                  {readiness.readinessScore}%
                </span>
              </div>
              <div className="w-16 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${readiness.readinessScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* 5 Metric Readiness Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conducted Events</span>
              <p className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">{readiness.totalConducted}</p>
              <span className="text-[10px] text-slate-400">Total in AY window</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> HOD-Verified (Eligible)
              </span>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{readiness.eligibleCount}</p>
              <span className="text-[10px] text-emerald-700 font-bold">100% Verified for Report</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Awaiting HOD Review
              </span>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{readiness.pendingVerificationCount}</p>
              <span className="text-[10px] text-amber-700">Report submitted by faculty</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800">
              <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Missing Reports
              </span>
              <p className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">{readiness.missingReportsCount}</p>
              <span className="text-[10px] text-rose-700">No report submitted yet</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Excluded Proposals</span>
              <p className="text-xl font-black text-slate-600 dark:text-slate-400 mt-1">{readiness.excludedCount}</p>
              <span className="text-[10px] text-slate-400">Rejected or cancelled</span>
            </div>
          </div>

          {/* Missing Supplementary Warning */}
          {readinessData?.missingSupplementaryDocs?.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Supplementary Documentation Notice:</strong> {readinessData.missingSupplementaryDocs.length} eligible activity records are missing uploaded photographs or supporting document annexures.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADMIN CONSOLIDATED OVERVIEW (Section 9) */}
      {isInstitutionalScope && adminOverview && (
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rcpit-600" />
                Institutional Department Overview ({selectedAY})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized comparison across all {adminOverview.departments?.length || 0} academic departments.
              </p>
            </div>
          </div>

          {/* Department Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px]">
                  <th className="pb-3 px-2">Academic Department</th>
                  <th className="pb-3 px-2">Head of Department</th>
                  <th className="pb-3 px-2">Conducted Events</th>
                  <th className="pb-3 px-2">HOD-Verified (Eligible)</th>
                  <th className="pb-3 px-2">Report Status</th>
                  <th className="pb-3 px-2">Readiness</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminOverview.departments?.map(dept => (
                  <tr key={dept.department._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">
                      {dept.department.name} ({dept.department.code})
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                      {dept.department.hod?.name || 'Assigned HOD'}
                    </td>
                    <td className="py-3 px-2 font-semibold">
                      {dept.totalActivities}
                    </td>
                    <td className="py-3 px-2 font-bold text-emerald-600">
                      {dept.eligibleCount}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        dept.status === 'OFFICIAL_GENERATED' ? 'bg-emerald-100 text-emerald-800' :
                        dept.status === 'HOD_VERIFIED' ? 'bg-cyan-100 text-cyan-800' :
                        dept.status === 'DRAFT' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {dept.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold text-slate-700 dark:text-slate-300">
                      {dept.readinessScore}%
                    </td>
                    <td className="py-3 px-2 text-right space-x-1">
                      <button
                        onClick={() => setSelectedDeptId(dept.department._id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold text-xs rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        Inspect
                      </button>
                      {dept.pdfUrl && (
                        <a
                          href={dept.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-rcpit-50 text-rcpit-600 font-bold text-xs rounded-lg inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT DRAFT GENERATION / REVIEW WORKSPACE (Section 12) */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                currentReport?.status === 'OFFICIAL_GENERATED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                currentReport?.status === 'HOD_VERIFIED' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' :
                currentReport ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-600'
              }`}>
                {currentReport ? `Status: ${currentReport.status} (v${currentReport.version || 1})` : 'Draft Not Yet Compiled'}
              </span>
              {currentReport?.pdfUrl && (
                <span className="text-xs text-slate-400 font-medium">
                  • Official PDF v{currentReport.version} Available
                </span>
              )}
            </div>

            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-1">
              {isInstitutionalScope
                ? `Consolidated Institutional Annual Report ${selectedAY}`
                : `Department Annual Activity Report — ${selectedAY}`}
            </h3>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Compile Draft */}
            <button
              onClick={handleGenerateDraft}
              disabled={generatingDraft}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingDraft ? 'animate-spin' : ''}`} />
              {currentReport ? 'Recompile Draft' : 'Compile Annual Draft'}
            </button>

            {/* 2. Verify (HOD or Admin) */}
            {currentReport && currentReport.status === 'DRAFT' && (isHOD || isAdminOrDirector) && (
              <button
                onClick={handleVerifyReport}
                disabled={verifyingDraft}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {verifyingDraft ? 'Verifying...' : 'Verify & Endorse Report'}
              </button>
            )}

            {/* 3. Generate Official PDF */}
            {currentReport && (currentReport.status === 'HOD_VERIFIED' || currentReport.status === 'OFFICIAL_GENERATED' || isAdminOrDirector) && (
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="px-4 py-2 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {generatingPdf ? 'Building PDF...' : `Generate Official PDF (v${currentReport.status === 'OFFICIAL_GENERATED' ? (currentReport.version || 1) + 1 : currentReport.version || 1})`}
              </button>
            )}

            {/* 4. Open / Preview Existing PDF */}
            {currentReport?.pdfUrl && (
              <a
                href={currentReport.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> View Official PDF
              </a>
            )}
          </div>
        </div>

        {/* If no report draft compiled yet */}
        {!currentReport ? (
          <div className="py-12 text-center space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
              No Annual Report Draft Compiled Yet for {selectedAY}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Click the button below to automatically collect verified activities, calculate attendance metrics, and compile a structured 10-section institutional annual report.
            </p>
            <button
              onClick={handleGenerateDraft}
              disabled={generatingDraft}
              className="px-5 py-2.5 bg-rcpit-600 hover:bg-rcpit-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all"
            >
              {generatingDraft ? 'Compiling Report Data...' : 'Compile Annual Report Draft Now'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Eligible Verified Events</span>
                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{stats.totalActivities || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Student Participations</span>
                <p className="text-xl font-black text-rcpit-600 mt-1">{stats.totalAttendanceRecords || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Unique Attendees</span>
                <p className="text-xl font-black text-emerald-600 mt-1">{stats.uniqueParticipantsCount || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Budget Utilized</span>
                <p className="text-xl font-black text-amber-600 mt-1">₹{(stats.totalActualExpenditure || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Navigation Tabs for Preview Sections */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
              <button
                onClick={() => setReportPreviewTab('overview')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  reportPreviewTab === 'overview' ? 'bg-rcpit-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Executive Summary & Narrative
              </button>
              <button
                onClick={() => setReportPreviewTab('activities')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  reportPreviewTab === 'activities' ? 'bg-rcpit-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Activity Catalog ({draftContent.eligibleActivities?.length || 0})
              </button>
              <button
                onClick={() => setReportPreviewTab('participation')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  reportPreviewTab === 'participation' ? 'bg-rcpit-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Category & Attendance Visualizations
              </button>
              <button
                onClick={() => setReportPreviewTab('photos')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  reportPreviewTab === 'photos' ? 'bg-rcpit-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Photo Gallery ({draftContent.verifiedMedia?.length || 0})
              </button>
              <button
                onClick={() => setReportPreviewTab('annexures')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  reportPreviewTab === 'annexures' ? 'bg-rcpit-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Annexures & Document Index ({draftContent.supportingDocs?.length || 0})
              </button>
            </div>

            {/* TAB 1: EXECUTIVE SUMMARY & NARRATIVE */}
            {reportPreviewTab === 'overview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    Department Executive Summary & Context
                  </h4>
                  <button
                    onClick={() => setIsEditingNarrative(!isEditingNarrative)}
                    className="text-xs text-rcpit-600 dark:text-rcpit-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> {isEditingNarrative ? 'Cancel Editing' : 'Customize Narrative'}
                  </button>
                </div>

                {isEditingNarrative ? (
                  <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Department Overview:
                      </label>
                      <textarea
                        rows={3}
                        value={narrativeForm.departmentOverview}
                        onChange={(e) => setNarrativeForm({ ...narrativeForm, departmentOverview: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Executive Summary:
                      </label>
                      <textarea
                        rows={4}
                        value={narrativeForm.executiveSummary}
                        onChange={(e) => setNarrativeForm({ ...narrativeForm, executiveSummary: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Annual Conclusion & Future Directions:
                      </label>
                      <textarea
                        rows={3}
                        value={narrativeForm.annualConclusion}
                        onChange={(e) => setNarrativeForm({ ...narrativeForm, annualConclusion: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingNarrative(false)}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNarrative}
                        disabled={savingNarrative}
                        className="px-4 py-1.5 bg-rcpit-600 text-white font-extrabold rounded-lg shadow"
                      >
                        {savingNarrative ? 'Saving...' : 'Save Narrative'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 block mb-1">Department Overview:</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {currentReport.narrativeContent?.departmentOverview || 'Department profile loaded from institutional records.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 block mb-1">Executive Summary:</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {currentReport.narrativeContent?.executiveSummary || 'Executive summary compiled from eligible activities.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 block mb-1">Annual Conclusion:</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {currentReport.narrativeContent?.annualConclusion || 'Annual conclusion and outcomes documented.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DETAILED ACTIVITY CATALOG */}
            {reportPreviewTab === 'activities' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Every eligible activity verified by HOD included in the official annual report dossier:
                </p>

                <div className="space-y-3">
                  {draftContent.eligibleActivities?.map((act, idx) => (
                    <div
                      key={act._id || idx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-extrabold text-rcpit-600">#{idx + 1}</span>
                          <h5 className="font-black text-sm text-slate-900 dark:text-white">{act.title}</h5>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            {act.category}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified by HOD ({new Date(act.date).toLocaleDateString()})
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-500 pt-1">
                        <span><strong>Venue:</strong> {act.venueName || 'TBD'}</span>
                        <span><strong>Time:</strong> {act.isAllDay ? 'All-Day' : `${act.startTime} - ${act.endTime}`}</span>
                        <span><strong>Coordinator:</strong> {act.coordinator?.name || 'Faculty'}</span>
                        <span><strong>Attendance:</strong> {act.actualParticipants} logged</span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        {act.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: VISUALIZATIONS */}
            {reportPreviewTab === 'participation' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                    Activity Distribution by Category
                  </h4>
                  {categoryData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400">No category records.</div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                    Participant Demographics Breakdown
                  </h4>
                  <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Students', value: stats.studentParticipantsCount || 50 },
                            { name: 'Faculty', value: stats.facultyParticipantsCount || 10 },
                            { name: 'External', value: stats.externalParticipantsCount || 5 }
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          <Cell fill="#0284c7" />
                          <Cell fill="#059669" />
                          <Cell fill="#d97706" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PHOTO GALLERY */}
            {reportPreviewTab === 'photos' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Verified event photographs included in official publication:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {draftContent.verifiedMedia?.map((m, idx) => (
                    <div key={m._id || idx} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                      <div className="h-32 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                        {m.fileUrl ? (
                          <img src={m.fileUrl} alt={m.caption || 'Event'} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="p-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        {m.caption || m.fileName || 'Event Photo'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: ANNEXURES & DOCUMENT INDEX */}
            {reportPreviewTab === 'annexures' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Index of supporting documents, attendance sheets, and reports referenced in the annual report:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-extrabold uppercase text-[10px]">
                        <th className="pb-2">Document Name</th>
                        <th className="pb-2">Category</th>
                        <th className="pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {draftContent.supportingDocs?.map((d, idx) => (
                        <tr key={d._id || idx}>
                          <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{d.fileName}</td>
                          <td className="py-2.5 text-slate-500">{d.documentType}</td>
                          <td className="py-2.5">
                            <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-rcpit-600 font-bold hover:underline">
                              Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VERSION HISTORY ARCHIVE (Section 13) */}
            {currentReport.versionHistory?.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  Previous Official Report Versions
                </h4>
                <div className="space-y-2">
                  {currentReport.versionHistory.map(vh => (
                    <div
                      key={vh.version}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Version v{vh.version}</span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          Published: {new Date(vh.generatedAt).toLocaleString()} ({Math.round(vh.pdfFileSize / 1024)} KB)
                        </span>
                      </div>
                      <a
                        href={vh.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Download v{vh.version}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default AnnualReportManager;

