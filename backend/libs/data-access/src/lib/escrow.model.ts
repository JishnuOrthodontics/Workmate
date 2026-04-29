import { Schema, model, models } from 'mongoose';

export interface IEscrow {
  _id: string;
  jobId: string;
  customerId: string;
  workerId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  holdDate: Date;
  releaseConditions: {
    customerApproval: boolean;
    workerConfirmation: boolean;
    minHoldPeriod: number;
    autoReleaseAt: Date;
  };
  transactions: Array<{
    type: 'hold' | 'release' | 'refund' | 'dispute';
    amount: number;
    timestamp: Date;
    actor: string;
    notes: string;
  }>;
  dispute?: {
    raisedBy: string;
    reason: string;
    status: 'pending' | 'investigating' | 'resolved';
    resolution?: string;
    resolvedAt?: Date;
    arbitrator?: string;
  };
}

const EscrowSchema = new Schema<IEscrow>({
  jobId: { type: String, required: true },
  customerId: { type: String, required: true },
  workerId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['held', 'released', 'refunded', 'disputed'],
    default: 'held'
  },
  holdDate: { type: Date, default: Date.now },
  releaseConditions: {
    customerApproval: { type: Boolean, default: false },
    workerConfirmation: { type: Boolean, default: false },
    minHoldPeriod: { type: Number, default: 24 }, // hours
    autoReleaseAt: Date
  },
  transactions: [{
    type: { type: String, enum: ['hold', 'release', 'refund', 'dispute'] },
    amount: Number,
    timestamp: { type: Date, default: Date.now },
    actor: String,
    notes: String
  }],
  dispute: {
    raisedBy: String,
    reason: String,
    status: { type: String, enum: ['pending', 'investigating', 'resolved'] },
    resolution: String,
    resolvedAt: Date,
    arbitrator: String
  }
}, { timestamps: true });

export const EscrowModel = models.Escrow || model<IEscrow>('Escrow', EscrowSchema);
