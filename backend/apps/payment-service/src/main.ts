import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { JobModel } from '../../../libs/data-access/src/lib/jobs.model';
import { EscrowModel } from '../../../libs/data-access/src/lib/escrow.model';
import { UserModel } from '../../../libs/data-access/src/lib/user.model';
import { PayoutBatchModel } from '../../../libs/data-access/src/lib/payout.model';
import { NotificationModel } from '../../../libs/data-access/src/lib/notification.model';

const app = express();
const port = Number(process.env.PORT || 3003);
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/d4dent';

const phonePeSaltKey = process.env.PHONEPE_SALT_KEY || 'phonepe-sandbox-key';
const phonePeSaltIndex = process.env.PHONEPE_SALT_INDEX || '1';
const phonePeMerchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
const payoutWindowDays = Number(process.env.PAYOUT_WINDOW_DAYS || 7);
const internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN || 'workmate-internal-dev-token';

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api', (req, res, next) => {
  const token = String(req.headers['x-internal-service-token'] || '');
  if (token !== internalServiceToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized internal caller' });
  }
  return next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'payment-service', mongoConnected: mongoose.connection.readyState === 1 });
});

function auditLog(event: string, details: Record<string, unknown>) {
  console.log('[payment-audit]', JSON.stringify({ event, at: new Date().toISOString(), ...details }));
}

async function createNotification(input: {
  recipientUid: string;
  recipientRole: 'customer' | 'provider';
  title: string;
  message: string;
  type: 'payment' | 'payout' | 'system';
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

function phonePeChecksum(base64Payload: string, endpointPath: string) {
  const digest = crypto.createHash('sha256').update(`${base64Payload}${endpointPath}${phonePeSaltKey}`).digest('hex');
  return `${digest}###${phonePeSaltIndex}`;
}

app.post('/api/payments/phonepe/create', async (req, res) => {
  try {
    const { jobId, idempotencyKey } = req.body as { jobId?: string; idempotencyKey?: string };
    if (!jobId) return res.status(400).json({ success: false, error: 'jobId is required' });

    const job = await JobModel.findOne({ jobId });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    if (job.payment.status === 'captured' || job.payment.status === 'released') {
      return res.json({ success: true, data: { alreadyPaid: true, transactionId: job.payment.transactionId, status: job.payment.status } });
    }

    if (idempotencyKey && job.payment.transactionId?.includes(idempotencyKey)) {
      return res.json({ success: true, data: { transactionId: job.payment.transactionId, status: job.payment.status, paymentUrl: `https://api-preprod.phonepe.com/sandbox/checkout/${job.payment.transactionId}` } });
    }

    const merchantTransactionId = `PHN-${Date.now()}-${Math.floor(Math.random() * 1000)}${idempotencyKey ? `-${idempotencyKey}` : ''}`;
    const payload = {
      merchantId: phonePeMerchantId,
      merchantTransactionId,
      amount: Math.round((job.pricing.finalPrice || 0) * 100),
      merchantOrderId: jobId,
      callbackUrl: `${process.env.PAYMENT_CALLBACK_BASE_URL || 'http://localhost:3003'}/api/payments/phonepe/webhook`,
      paymentInstrument: { type: 'PAY_PAGE' },
    };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = phonePeChecksum(base64Payload, '/pg/v1/pay');

    job.payment.method = 'upi';
    job.payment.status = 'authorized';
    job.payment.transactionId = merchantTransactionId;
    job.payment.paidAt = new Date();
    await job.save();
    auditLog('payment.intent.created', { jobId, transactionId: merchantTransactionId, status: 'authorized' });

    return res.json({
      success: true,
      data: {
        transactionId: merchantTransactionId,
        status: 'authorized',
        phonePe: { payload: base64Payload, checksum, endpoint: '/pg/v1/pay' },
        paymentUrl: `https://api-preprod.phonepe.com/sandbox/checkout/${merchantTransactionId}`,
      },
    });
  } catch (error) {
    console.error('PhonePe create payment error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create payment session' });
  }
});

app.post('/api/payments/phonepe/webhook', async (req, res) => {
  try {
    const header = String(req.headers['x-verify'] || '');
    const raw = JSON.stringify(req.body || {});
    const expected = crypto.createHash('sha256').update(`${raw}${phonePeSaltKey}`).digest('hex');
    if (header && header !== expected) {
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const { merchantTransactionId, code } = req.body as { merchantTransactionId?: string; code?: string };
    if (!merchantTransactionId || !code) {
      return res.status(400).json({ success: false, error: 'merchantTransactionId and code are required' });
    }

    const job = await JobModel.findOne({ 'payment.transactionId': merchantTransactionId });
    if (!job) return res.status(404).json({ success: false, error: 'Payment transaction not found' });

    if (job.payment.status === 'captured' && code === 'PAYMENT_SUCCESS') {
      return res.json({ success: true, data: { idempotent: true, status: job.payment.status } });
    }

    if (code === 'PAYMENT_SUCCESS') {
      job.payment.status = 'captured';
      job.payment.paidAt = new Date();
      await job.save();
      auditLog('payment.captured', { jobId: job.jobId, transactionId: merchantTransactionId });
      await EscrowModel.findOneAndUpdate(
        { jobId: job.jobId },
        {
          $set: {
            customerId: job.customerId,
            workerId: job.workerId,
            amount: Number(job.pricing?.finalPrice || 0),
            currency: 'INR',
            status: 'held',
            holdDate: new Date(),
            releaseConditions: {
              customerApproval: false,
              workerConfirmation: false,
              minHoldPeriod: 24,
              autoReleaseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
          $setOnInsert: {
            transactions: [],
          },
          $push: {
            transactions: {
              type: 'hold',
              amount: Number(job.pricing?.finalPrice || 0),
              timestamp: new Date(),
              actor: job.customerId,
              notes: 'Payment captured and moved to escrow',
            },
          },
        },
        { upsert: true, new: true }
      );
      const [customer, provider] = await Promise.all([
        UserModel.findById(job.customerId).select('uid').lean(),
        UserModel.findById(job.workerId).select('uid').lean(),
      ]);
      if (customer?.uid) {
        await createNotification({
          recipientUid: String(customer.uid),
          recipientRole: 'customer',
          title: 'Payment captured',
          message: `Payment for booking ${job.jobId} was successful.`,
          type: 'payment',
          metadata: { jobId: job.jobId, paymentStatus: 'captured' },
        });
      }
      if (provider?.uid) {
        await createNotification({
          recipientUid: String(provider.uid),
          recipientRole: 'provider',
          title: 'Customer payment received',
          message: `Booking ${job.jobId} is now paid. You can start work.`,
          type: 'payment',
          metadata: { jobId: job.jobId, paymentStatus: 'captured' },
        });
      }
    } else if (code === 'PAYMENT_ERROR') {
      job.payment.status = 'pending';
      await job.save();
      auditLog('payment.failed', { jobId: job.jobId, transactionId: merchantTransactionId });
      const customer = await UserModel.findById(job.customerId).select('uid').lean();
      if (customer?.uid) {
        await createNotification({
          recipientUid: String(customer.uid),
          recipientRole: 'customer',
          title: 'Payment failed',
          message: `Payment for booking ${job.jobId} failed. Please retry.`,
          type: 'payment',
          metadata: { jobId: job.jobId, paymentStatus: 'pending' },
        });
      }
    }

    return res.json({ success: true, data: { jobId: job.jobId, status: job.payment.status } });
  } catch (error) {
    console.error('PhonePe webhook error:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

app.get('/api/payments/bookings/:jobId/status', async (req, res) => {
  try {
    const job = await JobModel.findOne({ jobId: req.params.jobId }).lean();
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.json({
      success: true,
      data: {
        jobId: job.jobId,
        paymentStatus: job.payment?.status || 'pending',
        paymentMethod: job.payment?.method || null,
        transactionId: job.payment?.transactionId || null,
        amount: job.pricing?.finalPrice || 0,
      },
    });
  } catch (error) {
    console.error('Payment status lookup error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch payment status' });
  }
});

app.post('/api/payouts/weekly/run', async (req, res) => {
  try {
    const { dryRun = false, idempotencyKey } = req.body as { dryRun?: boolean; idempotencyKey?: string };
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now.getTime() - payoutWindowDays * 24 * 60 * 60 * 1000);
    const batchId = `PO-${weekStart.toISOString().slice(0, 10)}-${weekEnd.toISOString().slice(0, 10)}`;

    const existingBatch = await PayoutBatchModel.findOne({ batchId, status: { $in: ['processing', 'success'] } }).lean();
    if (existingBatch && !dryRun) {
      return res.json({ success: true, data: { idempotent: true, batch: existingBatch } });
    }
    if (idempotencyKey && !dryRun) {
      const sameKeyBatch = await PayoutBatchModel.findOne({ batchId: `${batchId}-${idempotencyKey}` }).lean();
      if (sameKeyBatch) return res.json({ success: true, data: { idempotent: true, batch: sameKeyBatch } });
    }

    const alreadyPaidJobIds = (await PayoutBatchModel.find({ status: 'success' }).select('lineItems.jobIds').lean())
      .flatMap((b) => b.lineItems.flatMap((li) => li.jobIds));

    const eligibleJobs = await JobModel.find({
      status: 'completed',
      'payment.status': { $in: ['captured', 'released'] },
      updatedAt: { $gte: weekStart, $lte: weekEnd },
      jobId: { $nin: alreadyPaidJobIds },
    }).lean();

    const providersById = new Map<string, { providerId: string; grossAmount: number; commissionAmount: number; netAmount: number; jobIds: string[] }>();
    for (const job of eligibleJobs) {
      const current = providersById.get(job.workerId) || {
        providerId: job.workerId,
        grossAmount: 0,
        commissionAmount: 0,
        netAmount: 0,
        jobIds: [] as string[],
      };
      const gross = Number(job.pricing?.finalPrice || 0);
      const commission = Number(job.pricing?.platformCommission || 0);
      current.grossAmount += gross;
      current.commissionAmount += commission;
      current.netAmount += Math.max(0, gross - commission);
      current.jobIds.push(String((job as any).jobId));
      providersById.set(job.workerId, current);
    }

    const providerIds = [...providersById.keys()];
    const providerDocs = await UserModel.find({ _id: { $in: providerIds } }).select('uid').lean();
    const providerUidMap = new Map(providerDocs.map((p) => [String(p._id), p.uid]));

    const lineItems = [...providersById.values()].map((item) => ({
      providerId: item.providerId,
      providerUid: providerUidMap.get(item.providerId) || 'unknown',
      grossAmount: item.grossAmount,
      commissionAmount: item.commissionAmount,
      netAmount: item.netAmount,
      transferId: `PPY-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      status: dryRun ? 'pending' : 'success',
      jobIds: item.jobIds,
    }));

    const summary = {
      totalProviders: lineItems.length,
      totalGrossAmount: lineItems.reduce((s, x) => s + x.grossAmount, 0),
      totalCommissionAmount: lineItems.reduce((s, x) => s + x.commissionAmount, 0),
      totalNetAmount: lineItems.reduce((s, x) => s + x.netAmount, 0),
    };

    if (dryRun) {
      return res.json({ success: true, data: { dryRun: true, weekStart, weekEnd, ...summary, lineItems } });
    }

    const savedBatch = await PayoutBatchModel.create({
      batchId: idempotencyKey ? `${batchId}-${idempotencyKey}` : batchId,
      weekStart,
      weekEnd,
      ...summary,
      status: 'success',
      lineItems,
    });

    await JobModel.updateMany({ jobId: { $in: lineItems.flatMap((li) => li.jobIds) } }, { $set: { 'payment.status': 'released' } });
    auditLog('payout.batch.completed', { batchId: savedBatch.batchId, providers: lineItems.length, totalNetAmount: summary.totalNetAmount });
    await EscrowModel.updateMany(
      { jobId: { $in: lineItems.flatMap((li) => li.jobIds) }, status: 'held' },
      {
        $set: { status: 'released' },
        $push: {
          transactions: {
            type: 'release',
            amount: 0,
            timestamp: new Date(),
            actor: 'system',
            notes: 'Released after weekly payout batch',
          },
        },
      }
    );

    for (const lineItem of lineItems) {
      if (lineItem.providerUid && lineItem.providerUid !== 'unknown') {
        await createNotification({
          recipientUid: String(lineItem.providerUid),
          recipientRole: 'provider',
          title: 'Weekly payout processed',
          message: `₹${Math.round(lineItem.netAmount)} payout processed for batch ${savedBatch.batchId}.`,
          type: 'payout',
          metadata: { batchId: savedBatch.batchId, transferId: lineItem.transferId, amount: lineItem.netAmount },
        });
      }
    }

    return res.json({ success: true, data: savedBatch });
  } catch (error) {
    console.error('Weekly payout run failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to run weekly payout' });
  }
});

app.get('/api/payouts/provider/:providerUid', async (req, res) => {
  try {
    const batches = await PayoutBatchModel.find({ 'lineItems.providerUid': req.params.providerUid }).sort({ createdAt: -1 }).limit(20).lean();
    const history = batches.flatMap((b) =>
      b.lineItems
        .filter((li) => li.providerUid === req.params.providerUid)
        .map((li) => ({
          batchId: b.batchId,
          weekStart: b.weekStart,
          weekEnd: b.weekEnd,
          netAmount: li.netAmount,
          grossAmount: li.grossAmount,
          commissionAmount: li.commissionAmount,
          transferId: li.transferId,
          status: li.status,
          createdAt: b.createdAt,
        }))
    );
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('Payout provider history failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch provider payouts' });
  }
});

app.get('/api/payouts/provider/:providerUid/summary', async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now.getTime() - payoutWindowDays * 24 * 60 * 60 * 1000);
    const provider = await UserModel.findOne({ uid: req.params.providerUid, role: 'worker' }).lean();
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

    const jobs = await JobModel.find({
      workerId: String(provider._id),
      status: 'completed',
      updatedAt: { $gte: weekStart, $lte: now },
      'payment.status': { $in: ['captured', 'released'] },
    }).lean();

    const weekGross = jobs.reduce((s, j) => s + Number(j.pricing?.finalPrice || 0), 0);
    const weekCommission = jobs.reduce((s, j) => s + Number(j.pricing?.platformCommission || 0), 0);
    const weekNet = Math.max(0, weekGross - weekCommission);

    const lastPayout = await PayoutBatchModel.findOne({ 'lineItems.providerUid': req.params.providerUid }).sort({ createdAt: -1 }).lean();
    const lastLine = lastPayout?.lineItems.find((li) => li.providerUid === req.params.providerUid);

    return res.json({
      success: true,
      data: {
        pendingPayoutAmount: weekNet,
        weekGrossAmount: weekGross,
        weekCommissionAmount: weekCommission,
        lastPayoutStatus: lastLine?.status || 'none',
        lastPayoutAmount: lastLine?.netAmount || 0,
        lastPayoutAt: lastPayout?.createdAt || null,
      },
    });
  } catch (error) {
    console.error('Payout summary failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch payout summary' });
  }
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Payment Service: MongoDB connected');
    app.listen(port, () => {
      console.log(`Payment Service running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Payment Service: MongoDB error:', err);
    process.exit(1);
  });
