export type UserRole = 'customer' | 'worker' | 'admin' | 'nri_manager';

export type KYCLevel = 'basic' | 'standard' | 'premium';

export type Language = 'ml' | 'en' | 'hi';

export interface NSDCSkillCertification {
  nsdcId: string;
  skill: string;
  issuedDate: Date;
  expiryDate: Date;
  verifiedAt: Date;
}
