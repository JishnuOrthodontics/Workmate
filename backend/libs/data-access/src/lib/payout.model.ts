import { Schema, model, models } from 'mongoose';

export interface IPayoutLineItem {
  providerId: string;
  providerUid: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  transferId: string;
  status: 'pending' | 'success' | 'failed';
  jobIds: string[];
}

export interface IPayoutBatch {
  _id: string;
  batchId: string;
  weekStart: Date;
  weekEnd: Date;
  totalProviders: number;
  totalGrossAmount: number;
  totalCommissionAmount: number;
  totalNetAmount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  lineItems: IPayoutLineItem[];
  createdAt: Date;
  updatedAt: Date;
}

const PayoutLineItemSchema = new Schema<IPayoutLineItem>({
  providerId: { type: String, required: true },
  providerUid: { type: String, required: true },
  grossAmount: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  netAmount: { type: Number, required: true },
  transferId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  jobIds: [{ type: String, required: true }],
});

const PayoutBatchSchema = new Schema<IPayoutBatch>(
  {
    batchId: { type: String, required: true, unique: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    totalProviders: { type: Number, required: true },
    totalGrossAmount: { type: Number, required: true },
    totalCommissionAmount: { type: Number, required: true },
    totalNetAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'processing', 'success', 'failed'], default: 'pending' },
    lineItems: [PayoutLineItemSchema],
  },
  { timestamps: true }
);

PayoutBatchSchema.index({ weekStart: 1, weekEnd: 1 });
PayoutBatchSchema.index({ status: 1, createdAt: -1 });
PayoutBatchSchema.index({ 'lineItems.providerUid': 1, createdAt: -1 });

export const PayoutBatchModel = models.PayoutBatch || model<IPayoutBatch>('PayoutBatch', PayoutBatchSchema);
