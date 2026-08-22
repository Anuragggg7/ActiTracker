import Department from '../models/Department.js';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import { logAudit } from '../utils/auditLogger.js';
import { bootstrapSystemAdminAndDepts } from '../utils/bootstrap.js';

export const getDepartments = async (req, res) => {
  try {
    let departments = await Department.find({}).populate('hodId', 'name email employeeId designation phone profilePhoto');

    if (departments.length === 0) {
      console.log('[Departments Controller] No departments found in database, auto-bootstrapping default departments...');
      await bootstrapSystemAdminAndDepts();
      departments = await Department.find({}).populate('hodId', 'name email employeeId designation phone profilePhoto');
    }

    const enriched = await Promise.all(departments.map(async (dept) => {
      const facultyCount = await User.countDocuments({ departmentId: dept._id, role: 'FACULTY', status: 'APPROVED' });
      const activityCount = await Activity.countDocuments({ departmentId: dept._id });
      const completedCount = await Activity.countDocuments({ departmentId: dept._id, status: { $in: ['COMPLETED', 'ARCHIVED'] } });
      const performanceScore = activityCount > 0 ? Math.round((completedCount / activityCount) * 100) : 0;

      return {
        ...dept.toObject(),
        facultyCount,
        activityCount,
        completedCount,
        performanceScore
      };
    }));

    res.json({ success: true, count: enriched.length, departments: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate('hodId', 'name email employeeId designation phone profilePhoto');
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    const facultyList = await User.find({ departmentId: department._id, role: 'FACULTY' }).select('-passwordHash');
    const activities = await Activity.find({ departmentId: department._id }).sort({ date: -1 });

    res.json({
      success: true,
      department,
      facultyList,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, hodId } = req.body;

    const existing = await Department.findOne({ $or: [{ name }, { code }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Department name or code already exists' });
    }

    const dept = await Department.create({ name, code, description, hodId: hodId || null });

    if (hodId) {
      await User.findByIdAndUpdate(hodId, { departmentId: dept._id, role: 'HOD' });
    }

    await logAudit({ req, user: req.user, action: 'CREATE_DEPARTMENT', entity: 'Department', entityId: dept._id, details: `Department ${name} (${code}) created` });

    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change HOD (Admin) - Historical approval records preserve former HOD info
export const assignHod = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { newHodId } = req.body;

    const dept = await Department.findById(departmentId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    const previousHodId = dept.hodId;
    dept.hodId = newHodId;
    await dept.save();

    if (newHodId) {
      await User.findByIdAndUpdate(newHodId, { role: 'HOD', departmentId: dept._id });
    }

    await logAudit({
      req,
      user: req.user,
      action: 'HOD_CHANGED',
      entity: 'Department',
      entityId: dept._id,
      departmentName: dept.name,
      details: `HOD updated for ${dept.name}. Former approval logs remain unchanged.`
    });

    res.json({ success: true, message: `HOD successfully updated for ${dept.name}`, department: dept });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
