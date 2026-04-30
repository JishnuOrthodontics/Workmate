import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { UserModel } from '../../../libs/data-access/src/lib/user.model';
import { JobModel } from '../../../libs/data-access/src/lib/jobs.model';
import { NotificationModel } from '../../../libs/data-access/src/lib/notification.model';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/d4dent';
const paymentServiceBaseUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN || 'workmate-internal-dev-token';

const app = express();

type ProviderSearchQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availableToday?: boolean;
  weekends?: boolean;
  location?: string;
  page: number;
  pageSize: number;
};

type ProviderListItem = {
  id: string;
  name: string;
  phone: string;
  category: string;
  skills: string[];
  hourlyRateFrom: number;
  rating: number;
  yearsExperience: number;
  district: string;
  locality: string;
  isOnline: boolean;
  availabilityTags: string[];
};

type ProviderSearchResponse = {
  items: ProviderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type BookingStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
type AuthRole = 'customer' | 'provider';
type AuthClaims = { uid: string; role: AuthRole };

async function proxyPaymentService<T>(path: string, init?: RequestInit): Promise<T> {
  const existingHeaders = (init?.headers || {}) as Record<string, string>;
  const response = await fetch(`${paymentServiceBaseUrl}${path}`, {
    ...init,
    headers: {
      ...existingHeaders,
      'x-internal-service-token': internalServiceToken,
    },
  });
  const json = (await response.json()) as T;
  if (!response.ok) {
    throw new Error((json as any)?.error || `Payment service request failed (${response.status})`);
  }
  return json;
}

function extractToken(req: express.Request): string | null {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function verifyToken(req: express.Request): AuthClaims | null {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthClaims;
    if (!decoded?.uid || !decoded?.role) return null;
    return decoded;
  } catch {
    return null;
  }
}

function requireAuth(roles?: AuthRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const claims = verifyToken(req);
    if (!claims) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (roles && !roles.includes(claims.role)) return res.status(403).json({ success: false, error: 'Forbidden' });
    (req as any).auth = claims;
    return next();
  };
}

async function resolveUserByUid(uid: string, role: AuthRole) {
  return UserModel.findOne({ uid, role: role === 'provider' ? 'worker' : 'customer' })
    .select('_id uid role')
    .lean();
}

async function createNotification(input: {
  recipientUid: string;
  recipientRole: 'customer' | 'provider';
  title: string;
  message: string;
  type: 'availability' | 'booking' | 'payment' | 'payout' | 'system';
  metadata?: Record<string, unknown>;
}) {
  await NotificationModel.create({
    recipientUid: input.recipientUid,
    recipientRole: input.recipientRole,
    title: input.title,
    message: input.message,
    type: input.type,
    read: false,
    metadata: input.metadata || {},
  });
}

// Middleware
app.use(express.json());

// CORS configuration for React app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get('/', (req, res) => {
  res.send({ message: 'Hello API' });
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api',
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

app.get('/api/customers/:customerUid/profile', requireAuth(['customer']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.customerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const customer = await UserModel.findOne({ uid: req.params.customerUid, role: 'customer' })
      .select('uid profile settings updatedAt')
      .lean();
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    return res.json({
      success: true,
      data: {
        uid: customer.uid,
        name: customer.profile?.name || '',
        phone: customer.profile?.phone || '',
        location: customer.profile?.location?.district || '',
        language: customer.settings?.language || customer.profile?.language || 'en',
        notifications: {
          sms: Boolean(customer.settings?.notifications?.sms),
          whatsapp: Boolean(customer.settings?.notifications?.whatsapp),
          push: Boolean(customer.settings?.notifications?.push),
        },
        updatedAt: customer.updatedAt,
      },
    });
  } catch (error) {
    console.error('Fetch customer profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch customer profile' });
  }
});

app.patch('/api/customers/:customerUid/profile', requireAuth(['customer']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.customerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { name, phone, location, language, notifications } = req.body as {
      name?: string;
      phone?: string;
      location?: string;
      language?: 'en' | 'ml' | 'hi';
      notifications?: { sms?: boolean; whatsapp?: boolean; push?: boolean };
    };

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates['profile.name'] = String(name).trim();
    if (phone !== undefined) updates['profile.phone'] = String(phone).trim();
    if (location !== undefined) updates['profile.location.district'] = String(location).trim();
    if (language !== undefined) {
      updates['profile.language'] = language;
      updates['settings.language'] = language;
    }
    if (notifications) {
      if (notifications.sms !== undefined) updates['settings.notifications.sms'] = Boolean(notifications.sms);
      if (notifications.whatsapp !== undefined) updates['settings.notifications.whatsapp'] = Boolean(notifications.whatsapp);
      if (notifications.push !== undefined) updates['settings.notifications.push'] = Boolean(notifications.push);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid profile fields provided' });
    }

    const updated = await UserModel.findOneAndUpdate(
      { uid: req.params.customerUid, role: 'customer' },
      { $set: updates },
      { new: true }
    )
      .select('uid profile settings updatedAt')
      .lean();

    if (!updated) return res.status(404).json({ success: false, error: 'Customer not found' });

    return res.json({
      success: true,
      data: {
        uid: updated.uid,
        name: updated.profile?.name || '',
        phone: updated.profile?.phone || '',
        location: updated.profile?.location?.district || '',
        language: updated.settings?.language || updated.profile?.language || 'en',
        notifications: {
          sms: Boolean(updated.settings?.notifications?.sms),
          whatsapp: Boolean(updated.settings?.notifications?.whatsapp),
          push: Boolean(updated.settings?.notifications?.push),
        },
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update customer profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update customer profile' });
  }
});

// Provider Search Endpoint
app.get('/api/providers/search', async (req, res) => {
  try {
    const query: ProviderSearchQuery = {
      q: req.query.q ? String(req.query.q) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
      availableToday: req.query.availableToday === 'true',
      weekends: req.query.weekends === 'true',
      location: req.query.location ? String(req.query.location) : undefined,
      page: req.query.page ? Math.max(1, Number(req.query.page)) : 1,
      pageSize: req.query.pageSize ? Math.max(1, Number(req.query.pageSize)) : 12,
    };

    const mongoFilter: Record<string, unknown> = {
      role: 'worker',
      workerProfile: { $exists: true },
      'workerProfile.skills.0': { $exists: true },
    };

    if (query.q) {
      const re = new RegExp(query.q, 'i');
      mongoFilter.$or = [
        { 'profile.name': re },
        { 'workerProfile.skills.category': re },
      ];
    }

    if (query.location) {
      const re = new RegExp(query.location, 'i');
      const locationMatch = [
        { 'profile.location.district': re },
        { 'profile.location.taluk': re },
        { 'profile.location.village': re },
      ];
      if (mongoFilter.$or) {
        mongoFilter.$and = [{ $or: mongoFilter.$or as unknown[] }, { $or: locationMatch }];
        delete mongoFilter.$or;
      } else {
        mongoFilter.$or = locationMatch;
      }
    }

    const skillElem: Record<string, unknown> = {};
    if (query.category) skillElem.category = new RegExp(query.category, 'i');
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      skillElem.hourlyRate = {};
      if (query.minPrice !== undefined) (skillElem.hourlyRate as Record<string, number>).$gte = query.minPrice;
      if (query.maxPrice !== undefined) (skillElem.hourlyRate as Record<string, number>).$lte = query.maxPrice;
    }
    if (query.availableToday || query.weekends) {
      const days: number[] = [];
      if (query.availableToday) days.push(new Date().getDay());
      if (query.weekends) days.push(0, 6);
      skillElem['availability.days'] = { $in: [...new Set(days)] };
    }
    if (Object.keys(skillElem).length > 0) {
      mongoFilter['workerProfile.skills'] = { $elemMatch: skillElem };
    }

    if (query.minRating !== undefined) {
      mongoFilter['workerProfile.performance.rating'] = { $gte: query.minRating };
    }

    const skip = (query.page - 1) * query.pageSize;

    if (query.availableToday) {
      const day = new Date().getDay();
      mongoFilter.$and = [...((mongoFilter.$and as unknown[]) || []), {
        $or: [
          { 'workerProfile.isOnline': true },
          { 'workerProfile.skills': { $elemMatch: { 'availability.days': { $in: [day] } } } },
        ],
      }];
    }

    const [total, workers] = await Promise.all([
      UserModel.countDocuments(mongoFilter),
      UserModel.find(mongoFilter)
        .select('profile.name profile.phone profile.location workerProfile.skills workerProfile.performance.rating workerProfile.isOnline')
        .sort({ 'workerProfile.isOnline': -1, 'workerProfile.performance.rating': -1, updatedAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .lean(),
    ]);

    const items: ProviderListItem[] = workers.map((worker: any) => {
      const skills = (worker?.workerProfile?.skills || []) as Array<any>;
      const primarySkill = query.category
        ? skills.find((s) => query.category && new RegExp(query.category, 'i').test(String(s.category)))
        : skills[0];

      const hourlyRates = skills
        .map((s) => Number(s?.hourlyRate))
        .filter((n) => !Number.isNaN(n) && n > 0);
      const years = skills
        .map((s) => Number(s?.experienceYears))
        .filter((n) => !Number.isNaN(n) && n >= 0);

      const availabilityDays = new Set<number>();
      skills.forEach((s) => {
        (s?.availability?.days || []).forEach((d: number) => availabilityDays.add(d));
      });

      const availabilityTags: string[] = [];
      if (availabilityDays.has(new Date().getDay())) availabilityTags.push('Available today');
      if (availabilityDays.has(0) || availabilityDays.has(6)) availabilityTags.push('Weekends');
      if (availabilityTags.length === 0) availabilityTags.push('On request');

      return {
        id: String(worker._id),
        name: String(worker?.profile?.name || 'Provider'),
        phone: String(worker?.profile?.phone || ''),
        category: String(primarySkill?.category || 'General Services'),
        skills: skills.map((s) => String(s?.category || '')).filter(Boolean),
        hourlyRateFrom: hourlyRates.length > 0 ? Math.min(...hourlyRates) : 0,
        rating: Number(worker?.workerProfile?.performance?.rating || 0),
        yearsExperience: years.length > 0 ? Math.max(...years) : 0,
        district: String(worker?.profile?.location?.district || ''),
        locality: String(worker?.profile?.location?.village || worker?.profile?.location?.taluk || ''),
        isOnline: Boolean(worker?.workerProfile?.isOnline),
        availabilityTags: [Boolean(worker?.workerProfile?.isOnline) ? 'Online now' : '', ...availabilityTags].filter(Boolean),
      };
    });

    const payload: ProviderSearchResponse = {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Provider search failed:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to search providers',
    });
  }
});

app.get('/api/providers/:providerUid/availability', requireAuth(['provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.providerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const provider = await UserModel.findOne({ uid: req.params.providerUid, role: 'worker' })
      .select('uid workerProfile.isOnline workerProfile.lastStatusUpdatedAt')
      .lean();
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    return res.json({
      success: true,
      data: {
        uid: provider.uid,
        isOnline: Boolean(provider.workerProfile?.isOnline),
        lastStatusUpdatedAt: provider.workerProfile?.lastStatusUpdatedAt || null,
      },
    });
  } catch (error) {
    console.error('Get provider availability failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch provider availability' });
  }
});

app.patch('/api/providers/:providerUid/availability', requireAuth(['provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.providerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { isOnline } = req.body as { isOnline?: boolean };
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isOnline boolean is required' });
    }
    const provider = await UserModel.findOneAndUpdate(
      { uid: req.params.providerUid, role: 'worker' },
      { $set: { 'workerProfile.isOnline': isOnline, 'workerProfile.lastStatusUpdatedAt': new Date() } },
      { new: true }
    )
      .select('uid workerProfile.isOnline workerProfile.lastStatusUpdatedAt')
      .lean();
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });
    await createNotification({
      recipientUid: provider.uid,
      recipientRole: 'provider',
      title: isOnline ? 'You are online' : 'You are offline',
      message: isOnline
        ? 'You will appear in customer search with immediate availability.'
        : 'You are hidden from immediate-availability ranking.',
      type: 'availability',
      metadata: { isOnline },
    });
    return res.json({
      success: true,
      data: {
        uid: provider.uid,
        isOnline: Boolean(provider.workerProfile?.isOnline),
        lastStatusUpdatedAt: provider.workerProfile?.lastStatusUpdatedAt || null,
      },
    });
  } catch (error) {
    console.error('Update provider availability failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update provider availability' });
  }
});

// Create booking from customer to provider
app.post('/api/bookings', requireAuth(['customer']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    const { customerUid, providerId, serviceName, notes, scheduledAt } = req.body as {
      customerUid?: string;
      providerId?: string;
      serviceName?: string;
      notes?: string;
      scheduledAt?: string;
    };

    if (!customerUid || !providerId || !serviceName) {
      return res.status(400).json({ success: false, error: 'customerUid, providerId and serviceName are required' });
    }
    if (auth.uid !== customerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const customer = await UserModel.findOne({ uid: customerUid, role: 'customer' }).lean();
    const provider = await UserModel.findOne({ _id: providerId, role: 'worker' }).lean();
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

    const requestedStart = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const bookingId = `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const booking = await JobModel.create({
      jobId: bookingId,
      customerId: String(customer._id),
      workerId: String(provider._id),
      serviceId: 'custom-service',
      status: 'requested',
      priority: 'normal',
      schedule: {
        requestedDate: new Date(),
        scheduledStart: requestedStart,
      },
      location: {
        customer: {
          address: customer?.profile?.location?.district || 'Unknown',
          coordinates: customer?.profile?.location?.coordinates || [0, 0],
          ruralAccessNotes: notes || '',
        },
        worker: {
          lastUpdate: new Date(),
          coordinates: provider?.profile?.location?.coordinates || [0, 0],
        },
        serviceArea: provider?.profile?.location?.district || '',
        isRemote: false,
      },
      pricing: {
        basePrice: 0,
        platformCommission: 0,
        finalPrice: 0,
        breakdown: [{ item: serviceName, amount: 0 }],
      },
      payment: {
        method: 'cod',
        status: 'pending',
      },
      communication: { messages: [], voiceNotes: [], callLogs: [] },
      safety: {
        panicButton: { activated: false, resolved: false },
        checkins: [],
        hazardsReported: [],
      },
    });

    await createNotification({
      recipientUid: String(provider.uid),
      recipientRole: 'provider',
      title: 'New booking request',
      message: `${customer.profile.name} requested ${serviceName}.`,
      type: 'booking',
      metadata: { jobId: booking.jobId, status: booking.status },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: booking.jobId,
        status: booking.status,
        customerName: customer.profile.name,
        providerName: provider.profile.name,
        serviceName,
        scheduledAt: booking.schedule.scheduledStart,
      },
    });
  } catch (error) {
    console.error('Create booking failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

app.get('/api/bookings/customer/:customerUid', requireAuth(['customer']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.customerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const customer = await UserModel.findOne({ uid: req.params.customerUid, role: 'customer' }).lean();
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const rows = await JobModel.find({ customerId: String(customer._id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const providerIds = [...new Set(rows.map((r) => r.workerId))];
    const providers = await UserModel.find({ _id: { $in: providerIds } }).select('profile.name').lean();
    const providerMap = new Map(providers.map((p) => [String(p._id), p.profile?.name || 'Provider']));

    const items = rows.map((row) => ({
      id: row.jobId,
      status: row.status,
      paymentStatus: row.payment?.status || 'pending',
      serviceName: row.pricing?.breakdown?.[0]?.item || 'Service',
      scheduledAt: row.schedule?.scheduledStart,
      providerName: providerMap.get(row.workerId) || 'Provider',
    }));

    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('Fetch customer bookings failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

app.get('/api/bookings/provider/:providerUid', requireAuth(['provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.providerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const provider = await UserModel.findOne({ uid: req.params.providerUid, role: 'worker' }).lean();
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

    const rows = await JobModel.find({ workerId: String(provider._id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await UserModel.find({ _id: { $in: customerIds } }).select('profile.name').lean();
    const customerMap = new Map(customers.map((c) => [String(c._id), c.profile?.name || 'Customer']));

    const items = rows.map((row) => ({
      id: row.jobId,
      status: row.status,
      paymentStatus: row.payment?.status || 'pending',
      serviceName: row.pricing?.breakdown?.[0]?.item || 'Service',
      scheduledAt: row.schedule?.scheduledStart,
      customerName: customerMap.get(row.customerId) || 'Customer',
    }));

    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('Fetch provider bookings failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

app.patch('/api/bookings/:jobId/status', requireAuth(['customer', 'provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    const { status } = req.body as { status?: BookingStatus };
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const current = await JobModel.findOne({ jobId: req.params.jobId }).lean();
    if (!current) return res.status(404).json({ success: false, error: 'Booking not found' });
    const actor = await resolveUserByUid(auth.uid, auth.role);
    if (!actor) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const isOwner =
      (auth.role === 'customer' && String(current.customerId) === String(actor._id)) ||
      (auth.role === 'provider' && String(current.workerId) === String(actor._id));
    if (!isOwner) return res.status(403).json({ success: false, error: 'Forbidden' });

    const mappedStatus = status === 'in_progress' ? 'started' : status;
    const paymentStatus = current.payment?.status;
    const progressionRequiresPaid = mappedStatus === 'started' || mappedStatus === 'completed';
    if (progressionRequiresPaid && !['captured', 'released'].includes(String(paymentStatus))) {
      return res.status(409).json({
        success: false,
        error: 'Booking progression blocked until customer payment is captured',
      });
    }

    const next = await JobModel.findOneAndUpdate(
      { jobId: req.params.jobId },
      { $set: { status: mappedStatus } },
      { new: true }
    ).lean();

    const [customer, provider] = await Promise.all([
      UserModel.findById(next.customerId).select('uid profile.name').lean(),
      UserModel.findById(next.workerId).select('uid profile.name').lean(),
    ]);
    if (customer?.uid) {
      await createNotification({
        recipientUid: String(customer.uid),
        recipientRole: 'customer',
        title: `Booking ${status.replace('_', ' ')}`,
        message: `Your booking with ${provider?.profile?.name || 'provider'} is now ${status.replace('_', ' ')}.`,
        type: 'booking',
        metadata: { jobId: next.jobId, status: next.status },
      });
    }
    if (provider?.uid) {
      await createNotification({
        recipientUid: String(provider.uid),
        recipientRole: 'provider',
        title: `Booking ${status.replace('_', ' ')}`,
        message: `Booking ${next.jobId} status updated to ${status.replace('_', ' ')}.`,
        type: 'booking',
        metadata: { jobId: next.jobId, status: next.status },
      });
    }

    return res.json({ success: true, data: { id: next.jobId, status: next.status } });
  } catch (error) {
    console.error('Update booking failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update booking' });
  }
});

app.get('/api/notifications/:recipientUid', requireAuth(['customer', 'provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.recipientUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const role = req.query.role === 'provider' ? 'provider' : 'customer';
    if (role !== auth.role) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : 20;
    const rows = await NotificationModel.find({ recipientUid: req.params.recipientUid, recipientRole: role })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unread = await NotificationModel.countDocuments({
      recipientUid: req.params.recipientUid,
      recipientRole: role,
      read: false,
    });
    return res.json({ success: true, data: { items: rows, unreadCount: unread } });
  } catch (error) {
    console.error('Fetch notifications failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

app.patch('/api/notifications/:notificationId/read', requireAuth(['customer', 'provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    const current = await NotificationModel.findById(req.params.notificationId).select('recipientUid recipientRole').lean();
    if (!current) return res.status(404).json({ success: false, error: 'Notification not found' });
    if (current.recipientUid !== auth.uid || current.recipientRole !== auth.role) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const updated = await NotificationModel.findByIdAndUpdate(
      req.params.notificationId,
      { $set: { read: true } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ success: false, error: 'Notification not found' });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Mark notification read failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark notification read' });
  }
});

app.post('/api/payments/phonepe/create', requireAuth(['customer']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    const { jobId } = req.body as { jobId?: string };
    if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });
    const actor = await resolveUserByUid(auth.uid, 'customer');
    if (!actor) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const job = await JobModel.findOne({ jobId }).select('customerId').lean();
    if (!job) return res.status(404).json({ success: false, error: 'Booking not found' });
    if (String(job.customerId) !== String(actor._id)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const result = await proxyPaymentService('/api/payments/phonepe/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    return res.json(result);
  } catch (error) {
    console.error('Create payment intent failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/payments/phonepe/webhook', async (req, res) => {
  try {
    const result = await proxyPaymentService('/api/payments/phonepe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-verify': String(req.headers['x-verify'] || '') },
      body: JSON.stringify(req.body || {}),
    });
    return res.json(result);
  } catch (error) {
    console.error('Payment webhook relay failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/payments/bookings/:jobId/status', requireAuth(['customer', 'provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    const actor = await resolveUserByUid(auth.uid, auth.role);
    if (!actor) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const job = await JobModel.findOne({ jobId: req.params.jobId }).select('customerId workerId').lean();
    if (!job) return res.status(404).json({ success: false, error: 'Booking not found' });
    const allowed =
      (auth.role === 'customer' && String(job.customerId) === String(actor._id)) ||
      (auth.role === 'provider' && String(job.workerId) === String(actor._id));
    if (!allowed) return res.status(403).json({ success: false, error: 'Forbidden' });
    const result = await proxyPaymentService(`/api/payments/bookings/${req.params.jobId}/status`);
    return res.json(result);
  } catch (error) {
    console.error('Payment status relay failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api/payouts/weekly/run', requireAuth(['provider']), async (req, res) => {
  try {
    const result = await proxyPaymentService('/api/payouts/weekly/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    return res.json(result);
  } catch (error) {
    console.error('Weekly payout relay failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/payouts/provider/:providerUid', requireAuth(['provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.providerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const result = await proxyPaymentService(`/api/payouts/provider/${req.params.providerUid}`);
    return res.json(result);
  } catch (error) {
    console.error('Provider payout history relay failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/payouts/provider/:providerUid/summary', requireAuth(['provider']), async (req, res) => {
  try {
    const auth = (req as any).auth as AuthClaims;
    if (auth.uid !== req.params.providerUid) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const result = await proxyPaymentService(`/api/payouts/provider/${req.params.providerUid}/summary`);
    return res.json(result);
  } catch (error) {
    console.error('Provider payout summary relay failed:', error);
    return res.status(502).json({ success: false, error: (error as Error).message });
  }
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('API: MongoDB connected');
    app.listen(port, host, () => {
      console.log(`[ ready ] http://${host}:${port}`);
    });
  })
  .catch((err) => {
    console.error('API: MongoDB connection error', err);
    process.exit(1);
  });
