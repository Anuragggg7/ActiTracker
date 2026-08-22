import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/activitytracker_rcpit';

  if (!uri) {
    console.error('❌ [MongoDB Failure] MONGODB_URI is missing from environment.');
    process.exit(1);
  }
  
  try {
    // Set a short 2.5s connection timeout so we fall back quickly if local MongoDB service is not running
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`✅ [MongoDB Success] Connected to primary database host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.log(`⚠️ [MongoDB Warning] Primary database connection failed (${error.message}). Attempting In-Memory MongoServer fallback...`);
    try {
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      const conn = await mongoose.connect(mongoUri);
      console.log(`✅ [MongoDB Success] Connected to In-Memory Database host: ${conn.connection.host}`);
      return conn;
    } catch (memErr) {
      console.error(`❌ [MongoDB Connection Failure] Unable to connect to MongoDB: ${memErr.message}`);
      process.exit(1);
    }
  }
};
