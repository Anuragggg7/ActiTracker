import { authenticateUserService, generateToken } from '../services/authService.js';
import { changeFacultyPasswordService } from '../services/userService.js';
import User from '../models/User.js';

// Login user
export const login = async (req, res) => {
  try {
    const { email, employeeId, password } = req.body;
    const identifier = email || employeeId || req.body.username;

    if (!identifier || !identifier.toString().trim() || !password) {
      return res.status(400).json({ success: false, message: 'Official Employee ID / Email and Password are required' });
    }

    const { user, token } = await authenticateUserService(identifier, password);

    const userPayload = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.departmentId,
      departmentId: user.departmentId?._id || user.departmentId,
      isSystemAdmin: user.isSystemAdmin,
      status: user.status
    };

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userPayload,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          employeeId: user.employeeId,
          role: user.role,
          departmentId: user.departmentId?._id || user.departmentId
        }
      }
    });
  } catch (error) {
    const statusCode = error.message.includes('inactive') ? 403 : 401;
    return res.status(statusCode).json({ success: false, message: error.message });
  }
};

// Deprecated Faculty Self-Registration Endpoint
export const registerFaculty = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Faculty self-registration has been removed. Institutional accounts and credentials are provisioned directly by RCPIT System Administration.'
  });
};

// Refresh JWT Session
export const refreshToken = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated session' });
    }
    const token = generateToken(req.user._id);
    res.json({ success: true, token, user: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// User Logout
export const logout = async (req, res) => {
  try {
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current logged-in user profile
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash').populate('departmentId');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Logged-in user / Faculty changes own password
export const changePassword = async (req, res) => {
  try {
    const result = await changeFacultyPasswordService(req.user, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Reset database state for UAT testing
export const resetTestDatabase = async (req, res) => {
  try {
    const models = [
      (await import('../models/Activity.js')).default,
      (await import('../models/Attendance.js')).default,
      (await import('../models/SlotRequest.js')).default,
      (await import('../models/Media.js')).default,
      (await import('../models/Document.js')).default,
      (await import('../models/ActivityReport.js')).default,
      (await import('../models/Notification.js')).default,
      (await import('../models/AuditLog.js')).default,
      (await import('../models/Venue.js')).default
    ];

    for (const model of models) {
      await model.deleteMany({});
    }

    await User.deleteMany({ isSystemAdmin: { $ne: true } });
    const Department = (await import('../models/Department.js')).default;
    await Department.updateMany({}, { $unset: { hodId: "" } });

    const { bootstrapSystemAdminAndDepts } = await import('../utils/bootstrap.js');
    await bootstrapSystemAdminAndDepts();

    res.json({ success: true, message: 'Database reset cleanly for UAT test' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
