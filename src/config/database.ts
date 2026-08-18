import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(): Promise<typeof mongoose> {
  const mongoUri = (env.MONGO_URI && !env.MONGO_URI.includes('<replace'))
    ? env.MONGO_URI
    : 'mongodb://127.0.0.1:27017/productivityos';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[Database] Connected to MongoDB (${mongoUri.includes('@') ? mongoUri.split('@')[1] : mongoUri})`);
    return conn;
  } catch (err: any) {
    console.warn(`[Database] MongoDB connection warning (${err.message}). Local storage fallback active.`);
    return mongoose;
  }
}
