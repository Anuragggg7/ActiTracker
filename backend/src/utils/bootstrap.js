import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { logDbWrite } from './auditLogger.js';

/**
 * System Bootstrap Routine
 * Ensures the single System Administrator account and institutional department master structure
 * exist on server startup. Does NOT auto-populate fake/demo activities, media, or sample records.
 */
export const bootstrapSystemAdminAndDepts = async () => {
  try {
    // 1. Ensure Academic Master Departments Exist
    const deptList = [
      { name: 'Artificial Intelligence & Machine Learning', code: 'AIML' },
      { name: 'Artificial Intelligence & Data Science', code: 'AIDS' },
      { name: 'Computer Engineering', code: 'CE' },
      { name: 'Information Technology', code: 'IT' },
      { name: 'Mechanical Engineering', code: 'ME' },
      { name: 'Civil Engineering', code: 'CIVIL' },
      { name: 'Electrical Engineering', code: 'EE' },
      { name: 'Electronics & Telecommunication', code: 'EXTC' },
      { name: 'Training & Placement Cell', code: 'TP' }
    ];

    const deptMap = {};
    for (const d of deptList) {
      let deptDoc = await Department.findOne({ code: d.code });
      if (!deptDoc) {
        deptDoc = await Department.create(d);
        logDbWrite({ collection: 'departments', operation: 'CREATE', source: 'Bootstrap Routine', details: `Created master department: ${d.code}` });
        console.log(`[Bootstrap] Created Master Institutional Department: ${d.name} (${d.code})`);
      }
      deptMap[d.code] = deptDoc;
    }

    // 2. Ensure Single System Admin Account Exists
    const adminUser = await User.findOne({ role: 'ADMIN' });
    if (!adminUser) {
      const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;
      if (!adminPassword) {
        throw new Error('ADMIN_PASSWORD environment variable is required to initialize the System Administrator account.');
      }
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      const createdAdmin = await User.create({
        name: 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@rcpit.ac.in',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        employeeId: 'ADM-001',
        designation: 'System Administrator',
        status: 'APPROVED',
        isSystemAdmin: true
      });

      logDbWrite({ collection: 'users', operation: 'CREATE', source: 'Bootstrap Routine', userId: createdAdmin._id, details: 'Created System Administrator Master Account' });
      console.log('✅ [Bootstrap] Initial System Administrator Account Initialized (admin@rcpit.ac.in)');
    }
  } catch (err) {
    console.error('[Bootstrap Error]', err.message);
  }
};
