import { Schema, model, models } from 'mongoose';

export interface IJobLocation {
  customer: {
    address: string;
    landmark?: string;
    coordinates: [number, number];
    ruralAccessNotes?: string;
  };
  worker: {
    lastUpdate: Date;
    coordinates: [number, number];
    eta?: number;
  };
  serviceArea: string;
  isRemote: boolean;
}

export interface IJobPricing {
  basePrice: number;
  ruralSurcharge?: number;
  urgentSurcharge?: number;
  materialsCost?: number;
  platformCommission: number;
  tax?: number;
  finalPrice: number;
  breakdown: Array<{ item: string; amount: number }>;
}

export interface IPaymentInfo {
  method: 'cod' | 'upi' | 'card' | 'wallet' | 'escrow';
  status: 'pending' | 'authorized' | 'captured' | 'released' | 'refunded' | 'disputed';
  transactionId?: string;
  paidAt?: Date;
  escrow?: {
    held: boolean;
    releasedAt?: Date;
    releaseConditions: string;
    disputeResolution: {
      status: 'none' | 'pending' | 'resolved';
      resolution?: string;
      resolvedAt?: Date;
    };
  };
}

export interface IJobVerification {
  beforePhotos: string[];
  afterPhotos: string[];
  customerSignature?: string;
  workerSignature?: string;
  nriInspection?: {
    required: boolean;
    videoReport?: string;
    inspectorId?: string;
    status?: 'pending' | 'completed' | 'rejected';
  };
}

export interface IJobCommunication {
  messages: Array<{
    from: string;
    to: string;
    content: string;
    type: 'text' | 'voice' | 'image';
    language: string;
    translatedContent?: { ml: string; en: string };
    mlScore?: number;
    timestamp: Date;
  }>;
  voiceNotes: Array<{
    url: string;
    transcription?: string;
    language: string;
    duration: number;
  }>;
  callLogs: Array<{
    type: 'incoming' | 'outgoing';
    duration: number;
    connected: boolean;
    via: string;
  }>;
}

export interface IJobSafety {
  panicButton: {
    activated: boolean;
    activatedAt?: Date;
    resolved: boolean;
    responseTime?: number;
  };
  checkins: Array<{
    timestamp: Date;
    coordinates: [number, number];
    status: 'safe' | 'hazard' | 'delay';
  }>;
  hazardsReported: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    reportedAt: Date;
    resolvedAt?: Date;
  }>;
}

export interface IJob {
  _id: string;
  jobId: string;
  customerId: string;
  workerId: string;
  serviceId: string;
  status: 'requested' | 'worker_assigned' | 'accepted' | 'in_transit' | 'arrived' | 'started' | 'paused' | 'completed' | 'cancelled' | 'disputed' | 'refund_requested';
  priority: 'normal' | 'urgent' | 'emergency';
  schedule: {
    requestedDate: Date;
    scheduledStart: Date;
    scheduledEnd?: Date;
    actualStart?: Date;
    actualEnd?: Date;
    duration?: number;
  };
  location: IJobLocation;
  pricing: IJobPricing;
  payment: IPaymentInfo;
  verification?: IJobVerification;
  communication: IJobCommunication;
  safety: IJobSafety;
  nriSubscription?: {
    isSubscriptionJob: boolean;
    subscriptionId?: string;
    inspectionReport?: string;
    remoteViewing?: boolean;
    priorityLevel?: string;
  };
  metadata?: {
    weather?: {
      condition: string;
      temperature: number;
      rain: boolean;
    };
    seasonal: boolean;
    holiday: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<IJobLocation>({
  customer: {
    address: String,
    landmark: String,
    coordinates: { type: [Number], required: true },
    ruralAccessNotes: String
  },
  worker: {
    lastUpdate: Date,
    coordinates: [Number],
    eta: Number
  },
  serviceArea: String,
  isRemote: Boolean
});

const PricingSchema = new Schema<IJobPricing>({
  basePrice: Number,
  ruralSurcharge: Number,
  urgentSurcharge: Number,
  materialsCost: Number,
  platformCommission: Number,
  tax: Number,
  finalPrice: Number,
  breakdown: [{
    item: String,
    amount: Number
  }]
});

const PaymentSchema = new Schema<IPaymentInfo>({
  method: { type: String, enum: ['cod', 'upi', 'card', 'wallet', 'escrow'] },
  status: { type: String, enum: ['pending', 'authorized', 'captured', 'released', 'refunded', 'disputed'] },
  transactionId: String,
  paidAt: Date,
  escrow: {
    held: Boolean,
    releasedAt: Date,
    releaseConditions: String,
    disputeResolution: {
      status: { type: String, enum: ['none', 'pending', 'resolved'] },
      resolution: String,
      resolvedAt: Date
    }
  }
});

const VerificationSchema = new Schema<IJobVerification>({
  beforePhotos: [String],
  afterPhotos: [String],
  customerSignature: String,
  workerSignature: String,
  nriInspection: {
    required: Boolean,
    videoReport: String,
    inspectorId: String,
    status: { type: String, enum: ['pending', 'completed', 'rejected'] }
  }
});

const CommunicationSchema = new Schema<IJobCommunication>({
  messages: [{
    from: String,
    to: String,
    content: String,
    type: { type: String, enum: ['text', 'voice', 'image'] },
    language: String,
    translatedContent: {
      ml: String,
      en: String
    },
    mlScore: Number,
    timestamp: Date
  }],
  voiceNotes: [{
    url: String,
    transcription: String,
    language: String,
    duration: Number
  }],
  callLogs: [{
    type: { type: String, enum: ['incoming', 'outgoing'] },
    duration: Number,
    connected: Boolean,
    via: String
  }]
});

const SafetySchema = new Schema<IJobSafety>({
  panicButton: {
    activated: Boolean,
    activatedAt: Date,
    resolved: Boolean,
    responseTime: Number
  },
  checkins: [{
    timestamp: Date,
    coordinates: [Number, Number],
    status: { type: String, enum: ['safe', 'hazard', 'delay'] }
  }],
  hazardsReported: [{
    type: String,
    description: String,
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    reportedAt: Date,
    resolvedAt: Date
  }]
});

const JobSchema = new Schema<IJob>({
  jobId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true },
  workerId: { type: String, required: true },
  serviceId: { type: String, required: true },
  status: { 
    type: String, 
    enum: [
      'requested', 'worker_assigned', 'accepted', 'in_transit',
      'arrived', 'started', 'paused', 'completed', 'cancelled',
      'disputed', 'refund_requested'
    ],
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  schedule: {
    requestedDate: { type: Date, required: true },
    scheduledStart: { type: Date, required: true },
    scheduledEnd: Date,
    actualStart: Date,
    actualEnd: Date,
    duration: Number
  },
  location: LocationSchema,
  pricing: PricingSchema,
  payment: PaymentSchema,
  verification: VerificationSchema,
  communication: CommunicationSchema,
  safety: SafetySchema,
  nriSubscription: {
    isSubscriptionJob: Boolean,
    subscriptionId: String,
    inspectionReport: String,
    remoteViewing: Boolean,
    priorityLevel: String
  },
  metadata: {
    weather: {
      condition: String,
      temperature: Number,
      rain: Boolean
    },
    seasonal: Boolean,
    holiday: Boolean
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

JobSchema.index({ customerId: 1, createdAt: -1 });
JobSchema.index({ workerId: 1, status: 1, 'schedule.scheduledStart': 1 });
JobSchema.index({ status: 1, 'schedule.scheduledStart': 1, 'location.serviceArea': 1 });
JobSchema.index({ 'location.coordinates': '2dsphere' });
JobSchema.index({ jobId: 1 }, { unique: true });
JobSchema.index({ status: 1, priority: 1, 'location.isRemote': 1 });
JobSchema.index({ 'nriSubscription.subscriptionId': 1 });
JobSchema.index({ 'payment.escrow.held': 1, 'payment.status': 1 });
JobSchema.index({ serviceType: 1, 'schedule.scheduledStart': 1 });
JobSchema.index({ ttl: 1 }, { expireAfterSeconds: 0 });

export const JobModel = models.Job || model<IJob>('Job', JobSchema);
