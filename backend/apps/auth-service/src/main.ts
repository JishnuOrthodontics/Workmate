import express from 'express';
import cors from 'cors';
import mongoose, { Schema, model, models } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../../libs/data-access/src/lib/user.model';

const app = express();
const host = process.env.HOST ?? '0.0.0.0';
const port = process.env.PORT ? Number(process.env.PORT) : 3334;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/d4dent';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

type AuthRole = 'customer' | 'provider' | 'admin';

interface IAuthUser {
  uid: string;
  phone: string;
  passwordHash: string;
  role: AuthRole;
}

const AuthUserSchema = new Schema<IAuthUser>(
  {
    uid: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'provider', 'admin'], required: true },
  },
  { timestamps: true }
);

AuthUserSchema.index({ phone: 1, role: 1 }, { unique: true });

const AuthUserModel = models.AuthUser || model<IAuthUser>('AuthUser', AuthUserSchema);

async function migrateAuthUserIndexes() {
  try {
    const coll = AuthUserModel.collection;
    const indexes = await coll.indexes();
    const legacyPhoneUnique = indexes.some(
      (idx: { name?: string; unique?: boolean; key?: Record<string, number> }) =>
        idx.name === 'phone_1' && Boolean(idx.unique) && idx.key && Object.keys(idx.key).length === 1 && idx.key.phone === 1
    );
    if (legacyPhoneUnique) {
      await coll.dropIndex('phone_1');
      console.log('[auth-service] Dropped legacy AuthUser index phone_1 (use compound phone+role uniqueness)');
    }
  } catch (err) {
    console.warn('[auth-service] AuthUser index migration skipped:', err);
  }
}

async function ensureAdminUserProfile(uid: string, adminPhone: string, adminName: string) {
  const existing = await UserModel.findOne({ uid }).lean();
  if (existing) return;
  await UserModel.create({
    uid,
    role: 'admin',
    profile: {
      name: adminName,
      phone: adminPhone,
      language: 'en',
      location: {
        district: 'Kerala',
        taluk: '',
        village: '',
        pincode: '',
        coordinates: [0, 0],
      },
      verified: { aadhaar: false, pancard: false, skillCertifications: [] },
      kycLevel: 'basic',
    },
    settings: {
      notifications: { sms: true, whatsapp: true, push: true },
      language: 'en',
      voiceMode: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActive: new Date(),
  });
}

/** Seeds admin if missing. In non-production, always re-hashes password from env so local/docker login stays predictable. */
async function ensureDefaultAdmin() {
  const adminPhone = (process.env.ADMIN_PHONE || '9999999999').trim().replace(/\s+/g, '');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Workmate Admin';
  const refreshDevPassword = process.env.NODE_ENV !== 'production';

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    let auth = await AuthUserModel.findOne({ phone: adminPhone, role: 'admin' });

    if (!auth) {
      const uid = `admin_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await AuthUserModel.create({ uid, phone: adminPhone, passwordHash, role: 'admin' });
      await ensureAdminUserProfile(uid, adminPhone, adminName);
      console.log(`[auth-service] Seeded default admin for phone ${adminPhone}`);
      return;
    }

    if (refreshDevPassword) {
      auth.passwordHash = passwordHash;
      await auth.save();
      console.log(`[auth-service] Refreshed dev admin password hash for phone ${adminPhone}`);
    }

    await ensureAdminUserProfile(auth.uid, adminPhone, adminName);
  } catch (err) {
    console.error('[auth-service] ensureDefaultAdmin failed:', err);
  }
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password, role, location, service } = req.body as {
      name?: string;
      phone?: string;
      password?: string;
      role?: AuthRole;
      location?: string;
      service?: string;
    };

    const normalizedPhone = phone ? String(phone).trim().replace(/\s+/g, '') : '';

    if (!name || !normalizedPhone || !password || !role) {
      return res.status(400).json({ success: false, error: 'name, phone, password and role are required' });
    }
    if (role !== 'customer' && role !== 'provider' && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'role must be customer, provider or admin' });
    }
    if (role === 'admin') {
      return res.status(403).json({ success: false, error: 'Admin registration is disabled' });
    }

    const existing = await AuthUserModel.findOne({ phone: normalizedPhone }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: 'Phone already registered' });
    }

    const uid = `uid_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await AuthUserModel.create({ uid, phone: normalizedPhone, passwordHash, role });

    if (role === 'provider') {
      await UserModel.create({
        uid,
        role: 'worker',
        profile: {
          name,
          phone: normalizedPhone,
          language: 'en',
          location: {
            district: location || 'Unknown',
            taluk: '',
            village: '',
            pincode: '',
            coordinates: [0, 0],
          },
          verified: { aadhaar: false, pancard: false, skillCertifications: [] },
          kycLevel: 'basic',
        },
        settings: {
          notifications: { sms: true, whatsapp: true, push: true },
          language: 'en',
          voiceMode: false,
        },
        workerProfile: {
          skills: service
            ? [{ category: service, experienceYears: 0, certifications: [], hourlyRate: 0, currency: 'INR', availability: { days: [], slots: [] } }]
            : [],
          equipment: [],
          emergencyContact: { name: '', phone: '', relation: '' },
          safety: { lastCheckin: new Date(), panicButtonActivated: false, hazardReports: 0, safetyTrainingCompleted: false },
          insurance: { policyNumber: '', provider: '', validUntil: new Date(), coverage: { life: 0, accident: 0 } },
          performance: { rating: 0, totalJobs: 0, cancellationRate: 0, responseTime: 0, onTimeRate: 0 },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      });
    } else {
      await UserModel.create({
        uid,
        role: 'customer',
        profile: {
          name,
          phone: normalizedPhone,
          language: 'en',
          location: {
            district: location || 'Unknown',
            taluk: '',
            village: '',
            pincode: '',
            coordinates: [0, 0],
          },
          verified: { aadhaar: false, pancard: false, skillCertifications: [] },
          kycLevel: 'basic',
        },
        settings: {
          notifications: { sms: true, whatsapp: true, push: true },
          language: 'en',
          voiceMode: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActive: new Date(),
      });
    }

    return res.status(201).json({
      success: true,
      data: { uid, name, phone: normalizedPhone, role },
    });
  } catch (error) {
    console.error('Register failed', error);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password, role } = req.body as { phone?: string; password?: string; role?: AuthRole };
    if (!phone || !password || !role) {
      return res.status(400).json({ success: false, error: 'phone, password and role are required' });
    }

    const normalizedPhone = String(phone).trim().replace(/\s+/g, '');
    const normalizedRole = String(role).trim().toLowerCase() as AuthRole;
    if (normalizedRole !== 'customer' && normalizedRole !== 'provider' && normalizedRole !== 'admin') {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const authUser = await AuthUserModel.findOne({ phone: normalizedPhone, role: normalizedRole }).lean();
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, authUser.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = await UserModel.findOne({ uid: authUser.uid }).lean();
    const token = jwt.sign({ uid: authUser.uid, role: authUser.role }, jwtSecret, { expiresIn: '7d' });

    return res.json({
      success: true,
      data: {
        token,
        user: {
          uid: authUser.uid,
          role: authUser.role,
          name: user?.profile?.name || '',
          phone: authUser.phone,
          location: user?.profile?.location?.district || '',
        },
      },
    });
  } catch (error) {
    console.error('Login failed', error);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('Auth Service: MongoDB connected');
    await migrateAuthUserIndexes();
    try {
      await AuthUserModel.syncIndexes();
    } catch (idxErr) {
      console.warn('[auth-service] syncIndexes warning:', idxErr);
    }
    await ensureDefaultAdmin();
    app.listen(port, host, () => {
      console.log(`[auth-service] http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error('Auth Service: MongoDB connection error', err);
    process.exit(1);
  });
