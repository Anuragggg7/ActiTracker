import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/User.js';
import Department from '../models/Department.js';
import Venue from '../models/Venue.js';
import Activity from '../models/Activity.js';
import SlotRequest from '../models/SlotRequest.js';
import Media from '../models/Media.js';
import Document from '../models/Document.js';
import ActivityReport from '../models/ActivityReport.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Attendance from '../models/Attendance.js';
import { connectDB } from '../config/db.js';
import { bootstrapSystemAdminAndDepts } from './bootstrap.js';

export const clearDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database clear scripts are strictly disabled in production environment.');
  }
  try {
    await connectDB();
    console.log('[ClearData] Connecting to database...');

    // Clear dynamic application collections
    await Activity.deleteMany({});
    await Attendance.deleteMany({});
    await SlotRequest.deleteMany({});
    await Media.deleteMany({});
    await Document.deleteMany({});
    await ActivityReport.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await Venue.deleteMany({});

    // Clear non-system-admin users
    await User.deleteMany({ isSystemAdmin: { $ne: true } });

    // Reset HOD references in departments
    await Department.updateMany({}, { $unset: { hodId: "" } });

    console.log('=======================================================');
    console.log('✅ DATABASE CLEARED TO EMPTY STATE SUCCESSFULLY!');
    console.log('   All sample activities, media, attendance & demo data removed.');
    console.log('=======================================================');

    // Ensure System Admin & Department master structure remain intact
    await bootstrapSystemAdminAndDepts();
  } catch (err) {
    console.error('[ClearData Error]', err.message);
  } finally {
    mongoose.disconnect();
  }
  if (process.argv[1] && (process.argv[1].endsWith('clearData.js') || process.argv[1].includes('clearData'))) {
    clearDatabase();
  }
}
