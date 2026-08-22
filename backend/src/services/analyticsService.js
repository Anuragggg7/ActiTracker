import Activity from '../models/Activity.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import ActivityReport from '../models/ActivityReport.js';
import SlotRequest from '../models/SlotRequest.js';
import Venue from '../models/Venue.js';
import Document from '../models/Document.js';
import { buildAnalyticsMatchQuery, calculateFormulaPerformanceScore } from '../utils/analyticsHelpers.js';

// Executive Director Analytics
export const getDirectorAnalyticsService = async (query, user) => {
  const match = buildAnalyticsMatchQuery(query, user);

  // Executive KPIs Aggregation
  const totalActivities = await Activity.countDocuments(match);
  const completedActivities = await Activity.countDocuments({ ...match, status: { $in: ['COMPLETED', 'ARCHIVED'] } });
  const scheduledActivities = await Activity.countDocuments({ ...match, status: 'SCHEDULED' });
  const upcomingActivities = await Activity.countDocuments({ ...match, date: { $gte: new Date() } });

  // Participant Headcount Aggregation
  const reports = await ActivityReport.find({});
  const totalParticipants = reports.reduce((acc, r) => acc + (r.actualParticipants || 0), 0);

  // Attendance Aggregation
  const attendanceStats = await Attendance.aggregate([
    { $group: { _id: null, totalRecords: { $sum: 1 }, presentRecords: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'PRESENT'] }, 1, 0] } } } }
  ]);
  const avgAttendance = attendanceStats[0]?.totalRecords > 0
    ? Math.round((attendanceStats[0].presentRecords / attendanceStats[0].totalRecords) * 100)
    : 0;

  // Average Documentation Score
  const docScoreAgg = await Activity.aggregate([
    { $match: match },
    { $group: { _id: null, avgScore: { $avg: '$documentationScore' } } }
  ]);
  const avgDocumentationScore = Math.round(docScoreAgg[0]?.avgScore || 0);

  // Department Activity Comparison & Formula Performance Scores
  const departments = await Department.find({});
  const departmentComparison = await Promise.all(departments.map(async (dept) => {
    const deptMatch = { ...match, departmentId: dept._id };
    const count = await Activity.countDocuments(deptMatch);
    const completed = await Activity.countDocuments({ ...deptMatch, status: { $in: ['COMPLETED', 'ARCHIVED'] } });
    const verifiedReps = await ActivityReport.countDocuments({ status: 'VERIFIED' });

    const perf = calculateFormulaPerformanceScore({
      totalActivities: count,
      completedActivities: completed,
      avgDocScore: avgDocumentationScore,
      avgAttendance,
      verifiedReports: verifiedReps
    });

    return {
      id: dept._id,
      name: dept.name,
      code: dept.code,
      totalActivities: count,
      completedActivities: completed,
      performanceScore: perf.score,
      hasData: perf.hasData
    };
  }));

  // Category Distribution Aggregation Pipeline
  const categoryDistribution = await Activity.aggregate([
    { $match: match },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $project: { name: '$_id', count: 1, _id: 0 } },
    { $sort: { count: -1 } }
  ]);

  // Monthly Activity Heatmap / Trends Aggregation Pipeline
  const monthlyTrends = await Activity.aggregate([
    { $match: match },
    {
      $group: {
        _id: { month: { $month: '$date' }, year: { $year: '$date' } },
        count: { $sum: 1 },
        completed: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'ARCHIVED']] }, 1, 0] } }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Rule-Based Insight Cards Calculation (100% MongoDB-derived)
  const insights = [];
  const topDept = departmentComparison.reduce((max, d) => (d.totalActivities > (max?.totalActivities || 0) ? d : max), null);
  if (topDept && topDept.totalActivities > 0 && totalActivities > 0) {
    const pct = Math.round((topDept.totalActivities / totalActivities) * 100);
    insights.push({ type: 'INFO', text: `${topDept.name} (${topDept.code}) conducted ${pct}% of institutional activities (${topDept.totalActivities} events).` });
  }

  // Attendance Alert Check (< 75%)
  const lowAttendanceActivities = await Attendance.aggregate([
    { $group: { _id: '$activityId', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'PRESENT'] }, 1, 0] } } } },
    { $project: { activityId: '$_id', total: 1, present: 1, pct: { $multiply: [{ $divide: ['$present', '$total'] }, 100] } } },
    { $match: { pct: { $lt: 75 }, total: { $gt: 0 } } }
  ]);

  if (lowAttendanceActivities.length > 0) {
    insights.push({ type: 'WARNING', text: `${lowAttendanceActivities.length} activities currently have attendance below the 75% threshold.` });
  }

  return {
    kpis: {
      totalActivities,
      completedActivities,
      scheduledActivities,
      upcomingActivities,
      totalParticipants,
      avgAttendance,
      completionRate: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
      avgDocumentationScore
    },
    departmentComparison,
    categoryDistribution,
    monthlyTrends,
    insights,
    attendanceAlertsCount: lowAttendanceActivities.length
  };
};

// Department Detailed Analytics & Comparison
export const getDepartmentAnalyticsService = async (query, user) => {
  const match = buildAnalyticsMatchQuery(query, user);
  const departments = await Department.find({}).populate('hodId', 'name email');

  const deptData = await Promise.all(departments.map(async (dept) => {
    const dMatch = { ...match, departmentId: dept._id };
    const totalActivities = await Activity.countDocuments(dMatch);
    const completedActivities = await Activity.countDocuments({ ...dMatch, status: { $in: ['COMPLETED', 'ARCHIVED'] } });
    const facultyCount = await User.countDocuments({ departmentId: dept._id, role: 'FACULTY', status: 'APPROVED' });

    const docScoreAgg = await Activity.aggregate([
      { $match: dMatch },
      { $group: { _id: null, avgScore: { $avg: '$documentationScore' } } }
    ]);
    const deptAvgDocScore = Math.round(docScoreAgg[0]?.avgScore || 0);

    const deptActivities = await Activity.find(dMatch).select('_id');
    const deptActIds = deptActivities.map(a => a._id);
    const attAgg = await Attendance.aggregate([
      { $match: { activityId: { $in: deptActIds } } },
      { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'PRESENT'] }, 1, 0] } } } }
    ]);
    const deptAvgAttendance = attAgg[0]?.total > 0 ? Math.round((attAgg[0].present / attAgg[0].total) * 100) : 0;

    const verifiedReports = await ActivityReport.countDocuments({ departmentId: dept._id, status: 'VERIFIED' });

    const perf = calculateFormulaPerformanceScore({
      totalActivities,
      completedActivities,
      avgDocScore: deptAvgDocScore,
      avgAttendance: deptAvgAttendance,
      verifiedReports
    });

    return {
      departmentId: dept._id,
      name: dept.name,
      code: dept.code,
      hod: dept.hodId?.name || 'Unassigned',
      facultyCount,
      totalActivities,
      completedActivities,
      completionRate: totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0,
      performanceScore: perf.score,
      hasData: perf.hasData
    };
  }));

  return deptData;
};

// Attendance & Threshold Alerts
export const getAttendanceAnalyticsService = async (query, user) => {
  const threshold = Number(query.threshold) || 75;

  const alerts = await Attendance.aggregate([
    { $group: { _id: '$activityId', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'PRESENT'] }, 1, 0] } } } },
    { $project: { activityId: '$_id', total: 1, present: 1, percentage: { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 0] } } },
    { $match: { percentage: { $lt: threshold }, total: { $gt: 0 } } },
    { $lookup: { from: 'activities', localField: 'activityId', foreignField: '_id', as: 'activity' } },
    { $unwind: '$activity' },
    { $project: { activityId: 1, total: 1, present: 1, percentage: 1, title: '$activity.title', category: '$activity.category', date: '$activity.date' } }
  ]);

  return { threshold, alertsCount: alerts.length, alerts };
};

// Venue Utilization Service
export const getVenueAnalyticsService = async (query, user) => {
  const venues = await Venue.find({});

  const utilization = await Promise.all(venues.map(async (v) => {
    const totalAllocations = await SlotRequest.countDocuments({ venueId: v._id, status: 'APPROVED' });
    const activityCount = await Activity.countDocuments({ venueId: v._id });

    return {
      venueId: v._id,
      name: v.name,
      code: v.code,
      capacity: v.capacity,
      location: v.location,
      totalAllocations,
      activityCount,
      utilizationRate: Math.min(100, Math.round((totalAllocations / 30) * 100))
    };
  }));

  return utilization;
};

// T&P Analytics Service
export const getTpAnalyticsService = async (query, user) => {
  const tpCategories = ['Placement Drive', 'Training', 'Industry Interaction', 'Industrial Visit', 'Recruitment Drive'];
  const match = { category: { $in: tpCategories } };

  const totalActivities = await Activity.countDocuments(match);
  const completedActivities = await Activity.countDocuments({ ...match, status: { $in: ['COMPLETED', 'ARCHIVED'] } });
  const upcomingActivities = await Activity.countDocuments({ ...match, date: { $gte: new Date() } });

  const activities = await Activity.find(match).select('_id');
  const activityIds = activities.map(a => a._id);

  const attendanceCount = await Attendance.countDocuments({ activityId: { $in: activityIds }, attendanceStatus: 'PRESENT' });

  return {
    kpis: {
      totalActivities,
      completedActivities,
      upcomingActivities,
      totalParticipants: attendanceCount
    }
  };
};

// Filtered CSV Export Service
export const generateAnalyticsCSVService = async (query, user) => {
  const match = buildAnalyticsMatchQuery(query, user);
  const activities = await Activity.find(match)
    .populate('departmentId', 'code name')
    .populate('coordinatorId', 'name')
    .populate('venueId', 'name')
    .sort({ date: -1 });

  let csv = 'Activity ID,Title,Category,Department,Coordinator,Date,Venue,Status,Documentation Score\n';
  activities.forEach(a => {
    csv += `"${a._id}","${a.title}","${a.category}","${a.departmentId?.name || ''}","${a.coordinatorId?.name || ''}","${new Date(a.date).toLocaleDateString()}","${a.venueName || a.venueId?.name || ''}","${a.status}","${a.documentationScore || 0}%"\n`;
  });

  return csv;
};
