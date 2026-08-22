import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Department from '../models/Department.js';

/**
 * System Bootstrap Routine
 * Ensures the single System Administrator account and institutional department master structure
 * exist on server startup. Does NOT auto-populate fake/demo activities, media, or sample records.
 */
export const bootstrapSystemAdminAndDepts = async () => {
  try {
    const userCount = await User.countDocuments();
    
    // 1. Ensure Academic Departments Exist
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
        console.log(`[Bootstrap] Created Institutional Department: ${d.name} (${d.code})`);
      }
      deptMap[d.code] = deptDoc;
    }

    // 2. Ensure Single System Admin Account Exists
    const adminUser = await User.findOne({ role: 'ADMIN' });
    if (!adminUser) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@rcpit2026';
      const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

      await User.create({
        name: 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@rcpit.ac.in',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        employeeId: 'ADM-001',
        designation: 'System Administrator',
        status: 'APPROVED',
        isSystemAdmin: true
      });
      console.log('✅ [Bootstrap] Initial System Administrator Account Created (admin@rcpit.ac.in)');
    }
  } catch (err) {
    console.error('[Bootstrap Error]', err.message);
  }
};
