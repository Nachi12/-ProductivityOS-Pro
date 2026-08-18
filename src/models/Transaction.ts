import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: string;
  familyId?: string;
  type: 'INCOME' | 'EXPENSE';
  amountInPaise: number;
  date: Date;
  description: string;
  category: string;
  source: 'MANUAL' | 'STATEMENT_IMPORT';
  merchant?: string;
  referenceNumber?: string;
  statementId?: string;
  importBatchId?: string;
  fingerprint?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: String, required: true, index: true },
  familyId: { type: String, default: null, index: true },
  type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true, index: true },
  amountInPaise: { type: Number, required: true },
  date: { type: Date, required: true, index: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true, index: true },
  source: { type: String, enum: ['MANUAL', 'STATEMENT_IMPORT'], default: 'MANUAL' },
  merchant: { type: String, default: '' },
  referenceNumber: { type: String, default: '' },
  statementId: { type: Schema.Types.ObjectId, ref: 'BankStatement', index: true },
  importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', index: true },
  fingerprint: { type: String, index: true },
  notes: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

// Compound indexes for analytical queries and duplicate prevention
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1 });
TransactionSchema.index({ userId: 1, fingerprint: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
