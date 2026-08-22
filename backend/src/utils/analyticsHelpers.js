import mongoose from 'mongoose';
import { calculateAcademicYear } from './academicYear.js';

/**
 * Parses global filter query params and constructs MongoDB `$match` stage
 * @param {Object} query - Express req.query
 * @param {Object} user - Authenticated user
 * @returns {Object} MongoDB match object
 */
export const buildAnalyticsMatchQuery = (query, user) => {
  const match = {};

  // Role Scope Enforcer (Backend Security)
  const userDeptId = user?.departmentId?._id || user?.departmentId;
  if (user?.role === 'HOD') {
    match.departmentId = new mongoose.Types.ObjectId(userDeptId);
  } else if (user?.role === 'FACULTY') {
    match.$or = [
      { coordinatorId: new mongoose.Types.ObjectId(user._id) },
      { departmentId: new mongoose.Types.ObjectId(userDeptId) }
    ];
  } else if (user?.role === 'TP') {
    match.$or = [
      { coordinatorId: new mongoose.Types.ObjectId(user._id) },
      { category: { $in: ['Placement Drive', 'Training', 'Industry Interaction', 'Industrial Visit', 'Recruitment Drive'] } }
    ];
  } else if (query.departmentId && ['ADMIN', 'DIRECTOR'].includes(user?.role)) {
    match.departmentId = new mongoose.Types.ObjectId(query.departmentId);
  }

  // Academic Year Filter
  if (query.academicYear) {
    const parts = query.academicYear.split('–');
    const startYear = parseInt(parts[0]);
    if (startYear) {
      const startDate = new Date(`${startYear}-06-01T00:00:00.000Z`);
      const endDate = new Date(`${startYear + 1}-05-31T23:59:59.999Z`);
      match.date = { $gte: startDate, $lte: endDate };
    }
  }

  // Custom Date Range Filter
  if (query.startDate || query.endDate) {
    match.date = match.date || {};
    if (query.startDate) match.date.$gte = new Date(query.startDate);
    if (query.endDate) match.date.$lte = new Date(query.endDate);
  }

  // Category Filter
  if (query.category) {
    match.category = query.category;
  }

  // Status Filter
  if (query.status) {
    match.status = query.status;
  }

  // Venue Filter
  if (query.venueId) {
    match.venueId = new mongoose.Types.ObjectId(query.venueId);
  }

  return match;
};

/**
 * Computes Formula-Based Department Performance Score (0-100%)
 * Completion Rate (30%) + Documentation Completeness (25%) + Average Attendance (20%) + Report Verification Rate (15%) + Timely Completion (10%)
 */
export const calculateFormulaPerformanceScore = ({ totalActivities, completedActivities, avgDocScore, avgAttendance, verifiedReports }) => {
  if (!totalActivities || totalActivities === 0) {
    return { score: 0, hasData: false };
  }

  const completionRateScore = (completedActivities / totalActivities) * 30; // Max 30
  const docScore = (Math.min(100, avgDocScore || 0) / 100) * 25; // Max 25
  const attScore = (Math.min(100, avgAttendance || 0) / 100) * 20; // Max 20
  const reportScore = (verifiedReports / (completedActivities || 1)) * 15; // Max 15
  const timelyScore = (completedActivities / totalActivities) * 10; // Max 10

  const totalScore = Math.round(completionRateScore + docScore + attScore + reportScore + timelyScore);
  return { score: Math.min(100, totalScore), hasData: true };
};
