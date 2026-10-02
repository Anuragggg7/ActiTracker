import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from workspace locations if MONGODB_URI is not yet loaded
if (!process.env.MONGODB_URI) {
  const possibleEnvPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env')
  ];

  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      if (process.env.MONGODB_URI) break;
    }
  }
}

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ [MongoDB Failure] MONGODB_URI is missing from environment.');
    console.error('   Ensure MONGODB_URI is defined in backend/.env or host environment variables.');
    throw new Error('MONGODB_URI missing from environment.');
  }

  const dbName = process.env.MONGODB_DB_NAME || 'activitytracker_rcpit';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const sanitizedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

  try {
    const conn = await mongoose.connect(uri, { dbName });
    const host = conn.connection.host || 'N/A';
    const actualDbName = conn.connection.db?.databaseName || dbName;

    console.log('=======================================================');
    console.log('✅ [MongoDB Atlas Connection Verified]');
    console.log(`   Environment:           ${nodeEnv}`);
    console.log(`   Database Host:         ${host}`);
    console.log(`   Database Name:         ${actualDbName}`);
    console.log(`   Sanitized Connection:  ${sanitizedUri}`);
    console.log('=======================================================');

    return conn;
  } catch (error) {
    console.error(`❌ [MongoDB Connection Failure] Cannot connect to database (${error.message}).`);
    throw error;
  }
};


