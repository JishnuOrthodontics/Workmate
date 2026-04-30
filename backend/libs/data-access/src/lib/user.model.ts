import { Schema, model, models } from 'mongoose';
import { UserRole, KYCLevel, Language } from './types/user.types';

export interface IUserProfile {
  name: string;
  phone: string;
  whatsapp?: string;
  language: Language;
  location: {
    district: string;
    taluk: string;
    village: string;
    pincode: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  verified: {
    aadhaar: boolean;
    pancard: boolean;
    skillCertifications: Array<{
      nsdcId: string;
      skill: string;
      issuedDate: Date;
      expiryDate: Date;
      verifiedAt: Date;
    }>;
  };
  kycLevel: KYCLevel;
}

export interface IWorkerProfile {
  isOnline?: boolean;
  lastStatusUpdatedAt?: Date;
  skills: Array<{
    category: string;
    experienceYears: number;
    certifications: string[];
    hourlyRate: number;
    currency: string;
    availability: {
      days: number[];
      slots: Array<{ start: string; end: string }>;
    };
  }>;
  equipment: Array<{ type: string; verified: boolean }>;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  safety: {
    lastCheckin: Date;
    panicButtonActivated: boolean;
    hazardReports: number;
    safetyTrainingCompleted: boolean;
  };
  insurance: {
    policyNumber: string;
    provider: string;
    validUntil: Date;
    coverage: {
      life: number;
      accident: number;
    };
  };
  performance: {
    rating: number;
    totalJobs: number;
    cancellationRate: number;
    responseTime: number;
    onTimeRate: number;
  };
  publicProfile?: {
    avatarUrl?: string;
    bannerUrl?: string;
    languages?: string[];
    title?: string;
    aboutShort?: string;
    aboutLong?: string;
    gallery?: string[];
    serviceHighlights?: Array<{
      name: string;
      description: string;
      icon?: string;
      charge?: number;
    }>;
  };
}

export interface INRIProfile {
  propertyLocations: Array<{
    address: string;
    coordinates: [number, number];
    propertyType: string;
    estimatedValue: number;
    inspectionSchedule: string;
  }>;
  subscriptionTier: string;
  remoteManagement: boolean;
}

export interface IUser {
  _id: string;
  uid: string;
  role: UserRole;
  profile: IUserProfile;
  settings: {
    notifications: {
      sms: boolean;
      whatsapp: boolean;
      push: boolean;
    };
    language: string;
    voiceMode: boolean;
    savedProviderIds?: string[];
  };
  nriProfile?: INRIProfile;
  workerProfile?: IWorkerProfile;
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;
}

const UserProfileSchema = new Schema<IUserProfile>({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  whatsapp: String,
  language: { type: String, enum: ['ml', 'en', 'hi'], default: 'ml' },
  location: {
    district: String,
    taluk: String,
    village: String,
    pincode: String,
    coordinates: { type: [Number], index: '2dsphere' }
  },
  verified: {
    aadhaar: Boolean,
    pancard: Boolean,
    skillCertifications: [{
      nsdcId: String,
      skill: String,
      issuedDate: Date,
      expiryDate: Date,
      verifiedAt: Date
    }]
  },
  kycLevel: { type: String, enum: ['basic', 'standard', 'premium'], default: 'basic' }
});

const WorkerProfileSchema = new Schema<IWorkerProfile>({
  isOnline: { type: Boolean, default: false },
  lastStatusUpdatedAt: Date,
  skills: [{
    category: String,
    experienceYears: Number,
    certifications: [String],
    hourlyRate: Number,
    currency: String,
    availability: {
      days: [Number],
      slots: [{
        start: String,
        end: String
      }]
    }
  }],
  equipment: [{
    type: String,
    verified: Boolean
  }],
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  safety: {
    lastCheckin: Date,
    panicButtonActivated: Boolean,
    hazardReports: Number,
    safetyTrainingCompleted: Boolean
  },
  insurance: {
    policyNumber: String,
    provider: String,
    validUntil: Date,
    coverage: {
      life: Number,
      accident: Number
    }
  },
  performance: {
    rating: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    responseTime: Number,
    onTimeRate: Number
  },
  publicProfile: {
    avatarUrl: String,
    bannerUrl: String,
    languages: [String],
    title: String,
    aboutShort: String,
    aboutLong: String,
    gallery: [String],
    serviceHighlights: [{
      name: String,
      description: String,
      icon: String,
      charge: Number
    }]
  }
});

const NRProfileSchema = new Schema<INRIProfile>({
  propertyLocations: [{
    address: String,
    coordinates: [Number],
    propertyType: String,
    estimatedValue: Number,
    inspectionSchedule: String
  }],
  subscriptionTier: String,
  remoteManagement: Boolean
});

const UserSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  role: { type: String, enum: ['customer', 'worker', 'admin', 'nri_manager'], required: true },
  profile: UserProfileSchema,
  settings: {
    notifications: {
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    language: { type: String, default: 'ml' },
    voiceMode: { type: Boolean, default: true },
    savedProviderIds: { type: [String], default: [] }
  },
  nriProfile: NRProfileSchema,
  workerProfile: WorkerProfileSchema,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastActive: Date
}, { timestamps: true });

UserSchema.index({ 'profile.location.coordinates': '2dsphere' });
UserSchema.index({ 'profile.location.district': 1, 'profile.location.taluk': 1 });
UserSchema.index({ role: 1, 'profile.verified.skillCertifications': 1 });
UserSchema.index({ 'workerProfile.skills.category': 1 });

export const UserModel = models.User || model<IUser>('User', UserSchema);
