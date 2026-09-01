import mongoose, { Schema, Document } from 'mongoose';

export interface IFamilyMember {
  memberId: string;
  name: string;
  relationship: string;
  userId?: string;
  email: string;
  permissions: {
    viewFinance: boolean;
    editFinance: boolean;
  };
}

export interface IFamily extends Document {
  familyId: string;
  name: string;
  ownerUserId: string;
  members: IFamilyMember[];
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMemberSchema = new Schema<IFamilyMember>({
  memberId: { type: String, required: true },
  name: { type: String, required: true },
  relationship: { type: String, default: 'Member' },
  userId: { type: String, default: null },
  email: { type: String, default: '' },
  permissions: {
    viewFinance: { type: Boolean, default: true },
    editFinance: { type: Boolean, default: false }
  }
}, { _id: false });

const FamilySchema = new Schema<IFamily>({
  familyId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'My Family' },
  ownerUserId: { type: String, required: true, index: true },
  members: [FamilyMemberSchema]
}, { timestamps: true });

export const Family = mongoose.model<IFamily>('Family', FamilySchema);
