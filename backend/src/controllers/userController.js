import {
  createFacultyService,
  updateFacultyService,
  toggleFacultyStatusService,
  resetFacultyPasswordService,
  getAllUsersService,
  getFacultyByIdService
} from '../services/userService.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Controller Layer: User & Faculty Account Operations
 * Architecture: Database → Service → Controller → API → Frontend
 */

// Admin Creates / Provisions Faculty Account
export const createFaculty = async (req, res) => {
  try {
    const faculty = await createFacultyService(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Faculty account provisioned successfully',
      faculty
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Admin Updates Faculty Account Details
export const updateFaculty = async (req, res) => {
  try {
    const facultyId = req.params.id || req.params.facultyId;
    const faculty = await updateFacultyService(req.user, facultyId, req.body);
    res.json({
      success: true,
      message: 'Faculty account profile updated successfully',
      faculty
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Admin Toggles / Modifies Account Status (Active / Inactive)
export const toggleUserStatus = async (req, res) => {
  try {
    const userId = req.params.userId || req.params.id || req.params.facultyId;
    const targetStatus = req.body.status;
    const user = await toggleFacultyStatusService(req.user, userId, targetStatus);
    res.json({
      success: true,
      message: `User status changed to ${user.status}`,
      user,
      faculty: user
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Admin Resets Faculty Password
export const resetFacultyPassword = async (req, res) => {
  try {
    const facultyId = req.params.id || req.params.facultyId;
    const { newPassword, password } = req.body;
    const result = await resetFacultyPasswordService(req.user, facultyId, newPassword || password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get All Users / Faculty Accounts
export const getAllUsers = async (req, res) => {
  try {
    const users = await getAllUsersService(req.query, req.user);
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Faculty / User Account Details
export const getFacultyById = async (req, res) => {
  try {
    const id = req.params.id || req.params.facultyId;
    const user = await getFacultyByIdService(id);
    res.json({ success: true, user, faculty: user });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

// Admin User Creation (Handles General Institutional User Accounts like HOD, Director, TP, Faculty)
export const createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, role, departmentId, employeeId, designation, phone } = req.body;

    if (role === 'ADMIN') {
      return res.status(400).json({ success: false, message: 'System Policy Violation: Only ONE Admin account is permitted.' });
    }

    if (role === 'FACULTY') {
      const faculty = await createFacultyService(req.user, req.body);
      return res.status(201).json({ success: true, message: 'FACULTY account created successfully', user: faculty, faculty });
    }

    const cleanEmail = email?.toLowerCase().trim();
    const cleanEmpId = (employeeId || `EMP-${Date.now().toString().slice(-4)}`).trim();

    const existingUser = await User.findOne({ $or: [{ email: cleanEmail }, { employeeId: cleanEmpId }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email or employee ID already exists' });
    }

    const passwordHash = await bcrypt.hash(password || 'Rcpit@123', 10);

    const newUser = await User.create({
      name: name?.trim(),
      email: cleanEmail,
      passwordHash,
      role,
      departmentId: departmentId || null,
      employeeId: cleanEmpId,
      facultyEmployeeId: cleanEmpId,
      designation: designation || (role === 'HOD' ? 'Head of Department' : role),
      phone: phone || '',
      status: 'ACTIVE'
    });

    if (role === 'HOD' && departmentId) {
      await Department.findByIdAndUpdate(departmentId, { hodId: newUser._id });
    }

    await logAudit({ req, user: req.user, action: 'ADMIN_CREATE_USER', entity: 'User', entityId: newUser._id, details: `Created ${role} account for ${name}` });

    res.status(201).json({ success: true, message: `${role} account created successfully`, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Faculty Transfer handling (Admin)
export const transferFacultyDepartment = async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { newDepartmentId } = req.body;

    const faculty = await User.findById(facultyId);
    if (!faculty || faculty.role !== 'FACULTY') {
      return res.status(404).json({ success: false, message: 'Faculty record not found' });
    }

    const newDept = await Department.findById(newDepartmentId);
    if (!newDept) return res.status(400).json({ success: false, message: 'Target department not found' });

    faculty.departmentId = newDepartmentId;
    await faculty.save();

    await logAudit({
      req,
      user: req.user,
      action: 'FACULTY_TRANSFER',
      entity: 'User',
      entityId: faculty._id,
      details: `Faculty ${faculty.name} transferred to ${newDept.name}. Historical records remain preserved.`
    });

    res.json({ success: true, message: `Faculty transferred to ${newDept.name}. Historical activity association preserved.`, faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Authenticated Secure Identity Card Photo Retrieval
export const getIdentityCardPhoto = async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId).populate('departmentId');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User record not found' });
    }

    if (!targetUser.identityCard || !targetUser.identityCard.fileUrl) {
      return res.status(404).json({ success: false, message: 'Identity card photo not uploaded for this user' });
    }

    const isSelf = req.user._id.toString() === userId.toString();
    const isAdminOrDirector = ['ADMIN', 'DIRECTOR'].includes(req.user.role);
    const targetDeptId = (targetUser.departmentId?._id || targetUser.departmentId)?.toString();
    const requesterDeptId = (req.user.departmentId?._id || req.user.departmentId)?.toString();
    const isDeptHod = req.user.role === 'HOD' && targetDeptId === requesterDeptId;

    if (!isSelf && !isAdminOrDirector && !isDeptHod) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not authorized to view identity card photos of faculty from another department.'
      });
    }

    res.json({
      success: true,
      identityCard: targetUser.identityCard,
      employeeId: targetUser.employeeId,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        department: targetUser.departmentId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Deprecated Registration Review Placeholders (For Backward API Compatibility)
export const getPendingFacultyRequests = async (req, res) => {
  res.json({ success: true, count: 0, requests: [] });
};
export const reviewFacultyRegistration = async (req, res) => {
  res.status(400).json({ success: false, message: 'Faculty self-registration approval workflow has been deprecated. Faculty accounts are provisioned directly by Admin.' });
};
export const approveFaculty = reviewFacultyRegistration;
export const rejectFaculty = reviewFacultyRegistration;
export const requestChangesFaculty = reviewFacultyRegistration;
