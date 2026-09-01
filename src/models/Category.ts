import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  userId?: string; // Null for global categories, set for custom user categories
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon?: string;
  color?: string;
  isSystem: boolean;
}

const CategorySchema = new Schema<ICategory>({
  userId: { type: String, default: null, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
  icon: { type: String, default: 'tag' },
  color: { type: String, default: '#3b82f6' },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true });

CategorySchema.index({ userId: 1, name: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
