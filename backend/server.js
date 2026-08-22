import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import User from './src/models/User.js';
import { bootstrapSystemAdminAndDepts } from './src/utils/bootstrap.js';
import { verifyEmailConnection } from './src/services/emailService.js';

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  try {
    await bootstrapSystemAdminAndDepts();
  } catch (err) {
    console.error('[Bootstrap Error]', err.message);
  }

  // Safe SMTP Connection Verification on Startup
  await verifyEmailConnection();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 ActivityTracker RCPIT Backend Server Running on Port ${PORT}`);
    console.log(`   Centralized Institutional Activity Management System`);
    console.log(`=======================================================`);
  });
}).catch((err) => {
  console.error(`❌ [MongoDB Startup Failure] Cannot start backend server without database: ${err.message}`);
  process.exit(1);
});
