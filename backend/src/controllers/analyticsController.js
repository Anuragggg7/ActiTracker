import {
  getDirectorAnalyticsService,
  getDepartmentAnalyticsService,
  getAttendanceAnalyticsService,
  getVenueAnalyticsService,
  getTpAnalyticsService,
  generateAnalyticsCSVService
} from '../services/analyticsService.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import SlotRequest from '../models/SlotRequest.js';

// Executive Director Dashboard Analytics
export const getDirectorAnalytics = async (req, res) => {
  try {
    const data = await getDirectorAnalyticsService(req.query, req.user);
    res.json({
      success: true,
      stats: data.kpis,
      departmentComparison: data.departmentComparison,
      categoryDistribution: data.categoryDistribution,
      monthlyTrends: data.monthlyTrends,
      insights: data.insights,
      attendanceAlertsCount: data.attendanceAlertsCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Department Detailed Analytics & Comparison
export const getDepartmentAnalytics = async (req, res) => {
  try {
    const departments = await getDepartmentAnalyticsService(req.query, req.user);
    res.json({ success: true, count: departments.length, departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Attendance Analytics & Threshold Alerts
export const getAttendanceAnalytics = async (req, res) => {
  try {
    const data = await getAttendanceAnalyticsService(req.query, req.user);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Venue Analytics
export const getVenueAnalytics = async (req, res) => {
  try {
    const venues = await getVenueAnalyticsService(req.query, req.user);
    res.json({ success: true, count: venues.length, venues });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// T&P Specific Analytics
export const getTpAnalytics = async (req, res) => {
  try {
    const data = await getTpAnalyticsService(req.query, req.user);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export Analytics CSV
export const exportAnalyticsCSV = async (req, res) => {
  try {
    const csvContent = await generateAnalyticsCSVService(req.query, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Institutional_Analytics_Export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Action Center Items
export const getActionCenterItems = async (req, res) => {
  try {
    const role = req.user.role;
    const items = [];

    if (role === 'FACULTY') {
      const pendingReports = await Activity.find({
        coordinatorId: req.user._id,
        status: { $in: ['CONDUCTED', 'REPORT_PENDING'] }
      });
      pendingReports.forEach(act => {
        items.push({
          id: act._id,
          title: `Post-Event Report Pending: "${act.title}"`,
          type: 'REPORT_PENDING',
          priority: 'HIGH',
          link: `/activities/${act._id}`
        });
      });

      const changesRequested = await Activity.find({
        coordinatorId: req.user._id,
        status: 'CHANGES_REQUIRED'
      });
      changesRequested.forEach(act => {
        items.push({
          id: act._id,
          title: `Changes Requested by HOD: "${act.title}"`,
          type: 'CHANGES_REQUIRED',
          priority: 'MEDIUM',
          link: `/activities/${act._id}`
        });
      });
    } else if (role === 'HOD') {
      const deptId = req.user.departmentId?._id || req.user.departmentId;

      const pendingEvents = await Activity.find({
        departmentId: deptId,
        status: 'SUBMITTED'
      });
      pendingEvents.forEach(act => {
        items.push({
          id: act._id,
          title: `Activity Review Required: "${act.title}"`,
          type: 'EVENT_APPROVAL',
          priority: 'HIGH',
          link: `/hod/activity-approvals`
        });
      });
    } else if (role === 'ADMIN') {
      const pendingSlots = await SlotRequest.countDocuments({ status: { $in: ['PENDING', 'CONFLICT_DETECTED'] } });
      if (pendingSlots > 0) {
        items.push({
          id: 'slots-pending',
          title: `${pendingSlots} Venue Slot Requests Awaiting Verification`,
          type: 'SLOT_REQUEST',
          priority: 'HIGH',
          link: '/admin/slots'
        });
      }
    }

    res.json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
