import mongoose, { Schema, Document } from 'mongoose';

export interface IImportBatch extends Document {
  userId: string;
  statementId: Schema.Types.ObjectId;
  importedCount: number;
  totalAmountInPaise: number;
  createdAt: Date;
}

const ImportBatchSchema = new Schema<IImportBatch>({
  userId: { type: String, required: true, index: true },
  statementId: { type: Schema.Types.ObjectId, ref: 'BankStatement', required: true, index: true },
  importedCount: { type: Number, required: true },
  totalAmountInPaise: { type: Number, required: true }
}, { timestamps: true });

export const ImportBatch = mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema);
