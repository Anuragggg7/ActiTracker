import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Service Layer: Authentication & Identity Management
 * Principle: DATABASE → SERVICE → CONTROLLER → API → FRONTEND
 */

export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'rcpit_activitytracker_jwt_secret_key_2026_super_secure', {
    expiresIn: '30d'
  });
};

/**
 * Authenticates user credentials against MongoDB record and determines official role
 * @param {String} identifier - Official Employee ID or Institutional Email
 * @param {String} password - User password
 * @returns {Object} { user, token }
 */
export const authenticateUserService = async (identifier, password) => {
  if (!identifier || !identifier.trim() || !password) {
    throw new Error('Official Employee ID / Email and Password are required');
  }

  const cleanIdentifier = identifier.trim();
  const query = {
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { employeeId: cleanIdentifier },
      { employeeId: cleanIdentifier.toUpperCase() },
      { facultyEmployeeId: cleanIdentifier.toUpperCase() }
    ]
  };

  const dbName = User.db.name;
  const collectionName = User.collection.name;

  console.log('\n--- [AUTH DIAGNOSTIC] ---');
  console.log(`DATABASE_NAME: ${dbName}`);
  console.log(`USERS_COLLECTION: ${collectionName}`);
  console.log(`IDENTIFIER_RECEIVED: ${cleanIdentifier}`);

  const user = await User.findOne(query).populate('departmentId');

  if (!user) {
    console.log('USER_FOUND: false');
    console.log('USER_EMAIL: N/A');
    console.log('USER_EMPLOYEE_ID: N/A');
    console.log('USER_ROLE: N/A');
    console.log('USER_STATUS: N/A');
    console.log('PASSWORD_HASH_EXISTS: false');
    console.log('PASSWORD_MATCH_RESULT: false');
    console.log('--------------------------\n');
    throw new Error('Invalid Employee ID/email or password.');
  }

  console.log('USER_FOUND: true');
  console.log(`USER_EMAIL: ${user.email}`);
  console.log(`USER_EMPLOYEE_ID: ${user.employeeId}`);
  console.log(`USER_ROLE: ${user.role}`);
  console.log(`USER_STATUS: ${user.status}`);
  console.log(`PASSWORD_HASH_EXISTS: ${Boolean(user.passwordHash)}`);

  const isMatch = await user.comparePassword(password);
  console.log(`PASSWORD_MATCH_RESULT: ${isMatch}`);
  console.log('--------------------------\n');

  if (!isMatch) {
    throw new Error('Invalid Employee ID/email or password.');
  }

  if (['INACTIVE', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(user.status)) {
    throw new Error('Your account is currently inactive. Please contact System Administration.');
  }

  // Generate new JWT session token and update active token on user document
  const token = generateToken(user._id);
  user.activeSessionToken = token;
  user.lastActiveAt = new Date();
  await user.save();

  await logAudit({
    user,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: user._id,
    details: `User logged in with role ${user.role} (${user.employeeId || user.email})`
  });

  return { user, token };
};
