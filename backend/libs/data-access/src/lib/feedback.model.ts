import { Schema, model, models } from 'mongoose';

export interface ICustomerFeedback {
  _id: string;
  jobId: string;
  customerUid: string;
  providerUid: string;
  rating: number;
  feedback: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerFeedbackSchema = new Schema<ICustomerFeedback>(
  {
    jobId: { type: String, required: true, index: true },
    customerUid: { type: String, required: true, index: true },
    providerUid: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, default: '' },
  },
  { timestamps: true }
);

CustomerFeedbackSchema.index({ jobId: 1, customerUid: 1 }, { unique: true });
CustomerFeedbackSchema.index({ providerUid: 1, createdAt: -1 });

export const CustomerFeedbackModel =
  models.CustomerFeedback || model<ICustomerFeedback>('CustomerFeedback', CustomerFeedbackSchema);
