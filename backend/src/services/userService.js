import User from '../models/User.js';
import Department from '../models/Department.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';
import { sendFacultyAccountCreatedEmail } from './emailService.js';

/**
 * Service Layer: Institutional Faculty & User Account Management
 * Strict separation: Database → Service → Controller → API → Frontend
 */

/**
 * Admin Provisions New Institutional Faculty Account
 * @param {Object} adminUser - Authenticated Admin User
 * @param {Object} facultyData - Faculty account creation payload
 */
export const createFacultyService = async (adminUser, facultyData) => {
  const {
    employeeId,
    name,
    email,
    password,
    departmentId,
    designation,
    specialization,
    qualification,
    phone,
    status
  } = facultyData;

  // 1. Employee ID: allow provided ID or auto-generate fallback
  const cleanEmployeeId = (employeeId && employeeId.trim()) ? employeeId.trim() : `FAC-${Date.now().toString().slice(-4)}`;

  // 2. Validation: Email required & non-empty
  if (!email || !email.trim()) {
    throw new Error('Official institutional email is required.');
  }

  // 3. Validation: Password requirement
  if (!password || !password.trim()) {
    throw new Error('Initial password is required for faculty account creation.');
  }
  const assignedPassword = password.trim();

  const cleanEmail = email.toLowerCase().trim();

  // 4. Unique Check: Employee ID uniqueness
  const existingEmpId = await User.findOne({ employeeId: cleanEmployeeId });
  if (existingEmpId) {
    throw new Error(`Account creation failed: Employee ID "${cleanEmployeeId}" is already assigned to another user.`);
  }

  // 5. Unique Check: Email uniqueness
  const existingEmail = await User.findOne({ email: cleanEmail });
  if (existingEmail) {
    throw new Error(`Account creation failed: Institutional email "${cleanEmail}" is already registered.`);
  }

  // 6. Validate Department
  let deptDoc = null;
  if (departmentId) {
    deptDoc = await Department.findById(departmentId);
    if (!deptDoc) {
      throw new Error('Selected department does not exist.');
    }
  }

  // 7. Password Hashing
  const passwordHash = await bcrypt.hash(assignedPassword, 10);

  // 8. Create User Document
  const newFaculty = await User.create({
    name: name.trim(),
    email: cleanEmail,
    passwordHash,
    role: 'FACULTY',
    employeeId: cleanEmployeeId,
    facultyEmployeeId: cleanEmployeeId,
    departmentId: departmentId || null,
    designation: designation || 'Assistant Professor',
    specialization: specialization || '',
    qualification: qualification || '',
    phone: phone || '',
    status: (status && ['ACTIVE', 'INACTIVE', 'APPROVED', 'SUSPENDED'].includes(status)) ? status : 'ACTIVE'
  });

  // 9. Audit Logging (Never log passwords!)
  await logAudit({
    user: adminUser,
    action: 'FACULTY_CREATED',
    entity: 'User',
    entityId: newFaculty._id,
    departmentName: deptDoc?.name || 'N/A',
    details: `Admin provisioned Faculty account for ${newFaculty.name} (${newFaculty.employeeId})`
  });

  // 10. Optional Non-Blocking Account Created Email Delivery
  sendFacultyAccountCreatedEmail({
    recipientEmail: newFaculty.email,
    facultyName: newFaculty.name,
    employeeId: newFaculty.employeeId,
    initialPassword: password,
    departmentName: deptDoc?.name || 'RCPIT Institution'
  }).catch((err) => {
    console.log(`[UserService] Account created email notification skipped/failed: ${err.message}`);
  });

  const createdUser = await User.findById(newFaculty._id).select('-passwordHash').populate('departmentId');
  return createdUser;
};

/**
 * Admin Updates Faculty Profile Information
 * @param {Object} adminUser - Authenticated Admin User
 * @param {String} facultyId - MongoDB ObjectId of Faculty
 * @param {Object} updateData - Profile updates
 */
export const updateFacultyService = async (adminUser, facultyId, updateData) => {
  const faculty = await User.findById(facultyId);
  if (!faculty) {
    throw new Error('Faculty record not found.');
  }

  // Enforcement: Employee ID is immutable through normal profile editing
  if (updateData.employeeId && updateData.employeeId.trim() !== faculty.employeeId) {
    // If Admin explicitly changes Employee ID, perform uniqueness check & log correction audit
    const newEmpId = updateData.employeeId.trim();
    const existingEmp = await User.findOne({ employeeId: newEmpId, _id: { $ne: facultyId } });
    if (existingEmp) {
      throw new Error(`Cannot update Employee ID: "${newEmpId}" is already assigned to another user.`);
    }

    const oldEmpId = faculty.employeeId;
    faculty.employeeId = newEmpId;
    faculty.facultyEmployeeId = newEmpId;

    await logAudit({
      user: adminUser,
      action: 'FACULTY_EMPLOYEE_ID_CORRECTED',
      entity: 'User',
      entityId: faculty._id,
      details: `Employee ID corrected from ${oldEmpId} to ${newEmpId} by Admin`
    });
  }

  // Update allowed profile fields
  if (updateData.name) faculty.name = updateData.name.trim();
  if (updateData.email) {
    const cleanEmail = updateData.email.toLowerCase().trim();
    const existingMail = await User.findOne({ email: cleanEmail, _id: { $ne: facultyId } });
    if (existingMail) {
      throw new Error(`Email "${cleanEmail}" is already in use by another user.`);
    }
    faculty.email = cleanEmail;
  }
  if (updateData.departmentId !== undefined) faculty.departmentId = updateData.departmentId;
  if (updateData.designation) faculty.designation = updateData.designation;
  if (updateData.specialization !== undefined) faculty.specialization = updateData.specialization;
  if (updateData.qualification !== undefined) faculty.qualification = updateData.qualification;
  if (updateData.phone !== undefined) faculty.phone = updateData.phone;
  if (updateData.status) {
    if (['ACTIVE', 'INACTIVE', 'APPROVED', 'SUSPENDED'].includes(updateData.status)) {
      faculty.status = updateData.status;
    }
  }

  await faculty.save();

  await logAudit({
    user: adminUser,
    action: 'FACULTY_UPDATED',
    entity: 'User',
    entityId: faculty._id,
    details: `Admin updated profile details for ${faculty.name}`
  });

  const updatedFaculty = await User.findById(faculty._id).select('-passwordHash').populate('departmentId');
  return updatedFaculty;
};

/**
 * Admin Activates or Deactivates Faculty Account
 */
export const toggleFacultyStatusService = async (adminUser, facultyId, targetStatus) => {
  const user = await User.findById(facultyId);
  if (!user) {
    throw new Error('User record not found.');
  }

  if (user.role === 'ADMIN') {
    throw new Error('System Policy Violation: Cannot modify System Admin account status.');
  }

  let newStatus = targetStatus;
  if (!newStatus) {
    // Toggle logically
    newStatus = (user.status === 'ACTIVE' || user.status === 'APPROVED') ? 'INACTIVE' : 'ACTIVE';
  }

  user.status = newStatus;
  await user.save();

  const actionLog = (newStatus === 'ACTIVE' || newStatus === 'APPROVED') ? 'FACULTY_ACTIVATED' : 'FACULTY_DEACTIVATED';
  await logAudit({
    user: adminUser,
    action: actionLog,
    entity: 'User',
    entityId: user._id,
    details: `Account status for ${user.name} changed to ${user.status}`
  });

  const updatedUser = await User.findById(user._id).select('-passwordHash').populate('departmentId');
  return updatedUser;
};

/**
 * Admin Resets Faculty Password
 */
export const resetFacultyPasswordService = async (adminUser, facultyId, newPassword) => {
  if (!newPassword || !newPassword.trim()) {
    throw new Error('New password cannot be empty.');
  }

  const faculty = await User.findById(facultyId);
  if (!faculty) {
    throw new Error('Faculty record not found.');
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  faculty.passwordHash = passwordHash;
  await faculty.save();

  await logAudit({
    user: adminUser,
    action: 'FACULTY_PASSWORD_RESET',
    entity: 'User',
    entityId: faculty._id,
    details: `Admin reset password for faculty ${faculty.name} (${faculty.employeeId})`
  });

  return { success: true, message: `Password for ${faculty.name} reset successfully.` };
};

/**
 * Logged-in User / Faculty Changes Own Password
 */
export const changeFacultyPasswordService = async (user, passwordPayload) => {
  const { currentPassword, newPassword, confirmPassword } = passwordPayload;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error('Current password, new password, and confirm password are required.');
  }

  if (newPassword.trim() !== confirmPassword.trim()) {
    throw new Error('New password and confirm password do not match.');
  }

  const userDoc = await User.findById(user._id);
  if (!userDoc) {
    throw new Error('User record not found.');
  }

  const isMatch = await userDoc.comparePassword(currentPassword);
  if (!isMatch) {
    throw new Error('Current password entered is incorrect.');
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  userDoc.passwordHash = passwordHash;
  await userDoc.save();

  await logAudit({
    user: userDoc,
    action: 'FACULTY_PASSWORD_CHANGED',
    entity: 'User',
    entityId: userDoc._id,
    details: `User ${userDoc.name} (${userDoc.employeeId}) changed their password`
  });

  return { success: true, message: 'Your password has been changed successfully.' };
};

/**
 * Fetch All Users / Faculty with Search & Role/Dept Filtering
 */
export const getAllUsersService = async (query = {}, requester = null) => {
  const { role, departmentId, search } = query;
  const mongoQuery = {};

  // If requester is HOD, restrict to their department faculty
  if (requester && requester.role === 'HOD') {
    const hodDeptId = requester.departmentId?._id || requester.departmentId;
    if (hodDeptId) {
      mongoQuery.departmentId = hodDeptId;
    }
  } else if (departmentId) {
    mongoQuery.departmentId = departmentId;
  }

  if (role) {
    mongoQuery.role = role;
  }

  if (search && search.trim()) {
    const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    mongoQuery.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { employeeId: { $regex: s, $options: 'i' } }
    ];
  }

  const users = await User.find(mongoQuery)
    .select('-passwordHash')
    .populate('departmentId')
    .sort({ createdAt: -1 });

  return users;
};

/**
 * Fetch Single Faculty Details
 */
export const getFacultyByIdService = async (id) => {
  const user = await User.findById(id).select('-passwordHash').populate('departmentId');
  if (!user) {
    throw new Error('User record not found.');
  }
  return user;
};
