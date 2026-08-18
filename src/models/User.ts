import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  passwordHash?: string;
  role: 'user' | 'admin';
  familyId?: string;
  preferences: {
    theme: 'dark' | 'light' | 'system';
    currency: string;
    monthlyGoalInPaise: number;
    emailNotifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  displayName: { type: String, default: '' },
  photoURL: { type: String, default: '' },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  familyId: { type: String, default: null, index: true },
  preferences: {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    currency: { type: String, default: 'INR' },
    monthlyGoalInPaise: { type: Number, default: 10000000 }, // Default ₹100,000.00
    emailNotifications: { type: Boolean, default: true }
  }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
