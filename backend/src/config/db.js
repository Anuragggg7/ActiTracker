import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dns from 'node:dns';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Node.js DNS resolution order to prevent IPv6 timeouts on Windows networks
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (err) {
  // Ignore if unsupported in environment
}

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

  // Auto-heal DNS for SRV queries if system DNS fails or times out
  if (uri.startsWith('mongodb+srv://')) {
    const srvDomain = uri.includes('@')
      ? uri.split('@')[1]?.split('/')[0]?.split('?')[0]
      : uri.split('mongodb+srv://')[1]?.split('/')[0]?.split('?')[0];

    if (srvDomain) {
      await new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('⚡ [DNS Auto-Fix] Primary DNS timed out. Configuring Google & Cloudflare DNS (8.8.8.8, 1.1.1.1)...');
            try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
            resolve();
          }
        }, 1500);

        dns.resolveSrv(`_mongodb._tcp.${srvDomain}`, (err, records) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            if (err || !records || records.length === 0) {
              console.log('⚡ [DNS Auto-Fix] Primary DNS SRV resolution failed. Configuring Google & Cloudflare DNS (8.8.8.8, 1.1.1.1)...');
              try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
            }
            resolve();
          }
        });
      });
    }
  }

  try {
    const conn = await mongoose.connect(uri, { dbName });
    const host = conn.connection.host || 'N/A';
    const actualDbName = conn.connection.db?.databaseName || dbName;

    console.log('=======================================================');
    console.log('✅ [MongoDB Connection Verified]');
    console.log(`   Environment:           ${nodeEnv}`);
    console.log(`   Database Host:         ${host}`);
    console.log(`   Database Name:         ${actualDbName}`);
    console.log(`   Sanitized Connection:  ${sanitizedUri}`);
    console.log('=======================================================');

    return conn;
  } catch (error) {
    console.warn(`⚠️ [MongoDB Warning] Primary database connection failed (${error.message}).`);

    if (nodeEnv === 'production') {
      console.error('❌ [MongoDB Startup Failure] Cannot start backend server without valid primary database in production.');
      throw error;
    }

    console.log('🔄 Attempting automatic local In-Memory MongoMemoryServer fallback for local development/testing...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const fallbackUri = mongoServer.getUri();
      const conn = await mongoose.connect(fallbackUri, { dbName });
      const host = conn.connection.host || '127.0.0.1';

      console.log('=======================================================');
      console.log('✅ [MongoDB In-Memory Fallback Connected]');
      console.log(`   Environment:           ${nodeEnv}`);
      console.log(`   Database Host:         ${host}`);
      console.log(`   Database Name:         ${dbName}`);
      console.log('=======================================================');

      return conn;
    } catch (fallbackError) {
      console.error(`❌ [MongoDB Connection Failure] Both primary database and In-Memory fallback failed (${fallbackError.message}).`);
      throw error;
    }
  }
};


