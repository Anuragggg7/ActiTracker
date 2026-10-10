import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rcpit_activitytracker_jwt_secret_key_2026_super_secure');
    const user = await User.findById(decoded.id).select('-passwordHash').populate('departmentId');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended by Administration.' });
    }

    // Session validation: If activeSessionToken is set and does not match the token presented (or was revoked by admin), terminate session
    if (user.activeSessionToken && user.activeSessionToken !== token) {
      return res.status(401).json({ success: false, message: 'Session invalidated: Account was logged out or accessed from another session.' });
    }

    // Update session timestamp asynchronously
    User.findByIdAndUpdate(user._id, { lastActiveAt: new Date() }).exec().catch(() => {});

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token verification failed or session expired' });
  }
};

export const authenticateUser = protect;

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user?.role}) is not authorized to access this resource`
      });
    }
    next();
  };
};

export const authorizeRole = authorize;

export const checkAccountStatus = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'User unauthenticated' });
  }
  if (req.user.role === 'FACULTY' && req.user.status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      message: `Account access restricted. Your faculty registration status is '${req.user.status}'.`,
      status: req.user.status
    });
  }
  if (req.user.status === 'SUSPENDED') {
    return res.status(403).json({ success: false, message: 'Your account has been suspended by Administration.' });
  }
  next();
};

export const checkDepartmentAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'User unauthenticated' });
  }
  if (req.user.role === 'ADMIN' || req.user.role === 'DIRECTOR') {
    return next();
  }
  const targetDeptId = req.params.departmentId || req.body.departmentId || req.query.departmentId;
  if (req.user.role === 'HOD' && targetDeptId) {
    const userDeptId = req.user.departmentId?._id?.toString() || req.user.departmentId?.toString();
    if (userDeptId && userDeptId !== targetDeptId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are only authorized to manage your own department.'
      });
    }
  }
  next();
};
