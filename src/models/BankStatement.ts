import mongoose, { Schema, Document } from 'mongoose';

export interface IBankStatement extends Document {
  userId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  bankName: string;
  parsedTransactionCount: number;
  importedTransactionCount: number;
  duplicateTransactionCount: number;
  status: 'PENDING' | 'PARSED' | 'IMPORTED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

const BankStatementSchema = new Schema<IBankStatement>({
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSizeBytes: { type: Number, required: true },
  bankName: { type: String, default: 'GENERIC' },
  parsedTransactionCount: { type: Number, default: 0 },
  importedTransactionCount: { type: Number, default: 0 },
  duplicateTransactionCount: { type: Number, default: 0 },
  status: { type: String, enum: ['PENDING', 'PARSED', 'IMPORTED', 'FAILED'], default: 'PENDING', index: true }
}, { timestamps: true });

BankStatementSchema.index({ userId: 1, createdAt: -1 });

export const BankStatement = mongoose.model<IBankStatement>('BankStatement', BankStatementSchema);
