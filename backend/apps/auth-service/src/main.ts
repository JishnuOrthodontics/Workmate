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

type AuthRole = 'customer' | 'provider';

interface IAuthUser {
  uid: string;
  phone: string;
  passwordHash: string;
  role: AuthRole;
}

const AuthUserSchema = new Schema<IAuthUser>(
  {
    uid: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'provider'], required: true },
  },
  { timestamps: true }
);

const AuthUserModel = models.AuthUser || model<IAuthUser>('AuthUser', AuthUserSchema);

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

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ success: false, error: 'name, phone, password and role are required' });
    }
    if (role !== 'customer' && role !== 'provider') {
      return res.status(400).json({ success: false, error: 'role must be customer or provider' });
    }

    const existing = await AuthUserModel.findOne({ phone }).lean();
    if (existing) {
      return res.status(409).json({ success: false, error: 'Phone already registered' });
    }

    const uid = `uid_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await AuthUserModel.create({ uid, phone, passwordHash, role });

    if (role === 'provider') {
      await UserModel.create({
        uid,
        role: 'worker',
        profile: {
          name,
          phone,
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
          phone,
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
      data: { uid, name, phone, role },
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

    const authUser = await AuthUserModel.findOne({ phone, role }).lean();
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
  .then(() => {
    console.log('Auth Service: MongoDB connected');
    app.listen(port, host, () => {
      console.log(`[auth-service] http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error('Auth Service: MongoDB connection error', err);
    process.exit(1);
  });
