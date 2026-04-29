import { Schema, model, models } from 'mongoose';

export interface INotification {
  _id: string;
  recipientUid: string;
  recipientRole: 'customer' | 'provider';
  title: string;
  message: string;
  type: 'availability' | 'booking' | 'payment' | 'payout' | 'system';
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientUid: { type: String, required: true, index: true },
    recipientRole: { type: String, enum: ['customer', 'provider'], required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['availability', 'booking', 'payment', 'payout', 'system'], default: 'system' },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientUid: 1, createdAt: -1 });

export const NotificationModel =
  models.Notification || model<INotification>('Notification', NotificationSchema);
