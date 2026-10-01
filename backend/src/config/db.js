import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/activitytracker_rcpit';

  if (!uri) {
    console.error('❌ [MongoDB Failure] MONGODB_URI is missing from environment.');
    process.exit(1);
  }
  
  try {
    const dbName = process.env.MONGODB_DB_NAME || 'activitytracker_rcpit';
    const conn = await mongoose.connect(uri, { dbName });
    console.log(`✅ [MongoDB Atlas] Connected successfully to host: ${conn.connection.host} | Database: ${conn.connection.db.databaseName}`);
    return conn;
  } catch (error) {
    console.error(`❌ [MongoDB Connection Failure] Cannot connect to MongoDB Atlas database (${error.message}).`);
    throw error;
  }
};

