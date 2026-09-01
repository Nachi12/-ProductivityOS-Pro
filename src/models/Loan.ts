import mongoose, { Schema, Document } from 'mongoose';

export interface ILoan extends Document {
  userId: string;
  name: string;
  lender: string;
  principalInPaise: number;
  remainingBalanceInPaise: number;
  interestRateAnnual: number; // e.g. 8.5 for 8.5%
  tenureMonths: number;
  monthlyEMIInPaise: number;
  startDate: Date;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  lender: { type: String, default: '' },
  principalInPaise: { type: Number, required: true },
  remainingBalanceInPaise: { type: Number, required: true },
  interestRateAnnual: { type: Number, required: true },
  tenureMonths: { type: Number, required: true },
  monthlyEMIInPaise: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE', index: true }
}, { timestamps: true });

LoanSchema.index({ userId: 1, status: 1 });

export const Loan = mongoose.model<ILoan>('Loan', LoanSchema);
