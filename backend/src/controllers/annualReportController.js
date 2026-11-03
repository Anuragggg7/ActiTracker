import {
  getAvailableAcademicYearsService,
  getAnnualReportReadinessService,
  generateAnnualReportDraftService,
  updateAnnualReportNarrativeService,
  verifyAnnualReportDraftService,
  generateOfficialAnnualReportPDFService,
  getAdminAnnualReportsOverviewService,
  generateConsolidatedInstitutionalDraftService
} from '../services/annualReportService.js';
import AnnualReport from '../models/AnnualReport.js';

/**
 * Controller: Get Available Academic Years
 */
export const getAcademicYears = async (req, res) => {
  try {
    const data = getAvailableAcademicYearsService();
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Get Annual Report Readiness & Eligibility Breakdown
 */
export const getReportReadiness = async (req, res) => {
  try {
    const { departmentId, academicYear } = req.query;
    const data = await getAnnualReportReadinessService({
      departmentId,
      academicYear,
      user: req.user
    });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Get Specific Annual Report by ID or Query
 */
export const getAnnualReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await AnnualReport.findById(id)
      .populate('departmentId', 'name code description hodId')
      .populate('verifiedBy', 'name email designation')
      .populate('generatedBy', 'name email designation')
      .populate('eligibleActivityIds', 'title category date startTime endTime venueName expectedParticipants description');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Annual report record not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Generate Annual Report Draft (Department Scope)
 */
export const generateDepartmentDraft = async (req, res) => {
  try {
    const { departmentId, academicYear } = req.body;
    const report = await generateAnnualReportDraftService({
      departmentId,
      academicYear,
      user: req.user,
      req
    });
    res.status(201).json({
      success: true,
      message: 'Annual report draft generated successfully based on HOD-verified records.',
      report
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Update Report Narrative Content (Executive Summary, Conclusion)
 */
export const updateReportNarrative = async (req, res) => {
  try {
    const { id } = req.params;
    const { narrativeContent } = req.body;
    const report = await updateAnnualReportNarrativeService({
      reportId: id,
      narrativeContent,
      user: req.user,
      req
    });
    res.json({
      success: true,
      message: 'Report narrative updated successfully',
      report
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Verify Annual Report Draft by HOD
 */
export const verifyReportDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationNotes } = req.body;
    const report = await verifyAnnualReportDraftService({
      reportId: id,
      verificationNotes,
      user: req.user,
      req
    });
    res.json({
      success: true,
      message: 'Annual report successfully verified and endorsed by HOD',
      report
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Generate Official Publication PDF & Manage Version
 */
export const generateOfficialPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await generateOfficialAnnualReportPDFService({
      reportId: id,
      user: req.user,
      req
    });
    res.json({
      success: true,
      message: `Official Annual Report PDF (v${report.version}) generated and stored successfully`,
      report
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Admin Centralized Overview across All Departments
 */
export const getAdminOverview = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const data = await getAdminAnnualReportsOverviewService({
      academicYear,
      user: req.user
    });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

/**
 * Controller: Generate Consolidated Institutional Report Draft
 */
export const generateConsolidatedDraft = async (req, res) => {
  try {
    const { academicYear } = req.body;
    const report = await generateConsolidatedInstitutionalDraftService({
      academicYear,
      user: req.user,
      req
    });
    res.status(201).json({
      success: true,
      message: 'Consolidated Institutional Annual Report draft generated successfully.',
      report
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

