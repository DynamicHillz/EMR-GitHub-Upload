import dotenv from 'dotenv';
// Load environment variables before Sentry initializes so SENTRY_DSN is
// available to it, and before any other backend module runs.
dotenv.config();
import './config/sentry'; // must init before Express is required, per Sentry's own setup docs
import * as Sentry from '@sentry/node';

import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './config/logger';
import { errorHandler } from './presentation/middleware/errorHandler';
import { authMiddleware } from './presentation/middleware/auth';
import { auditRequest } from './presentation/middleware/audit.middleware';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma.client';

// Import routes
import authRoutes from './presentation/routes/auth.routes';
import dashboardRoutes from './presentation/routes/dashboard.routes';
import patientRoutes from './presentation/routes/patient.routes';
import appointmentRoutes from './presentation/routes/appointment.routes';
import consultationRoutes from './presentation/routes/consultation.routes';
import prescriptionRoutes from './presentation/routes/prescription.routes';
import labRoutes from './presentation/routes/lab.routes';
import pharmacyRoutes from './presentation/routes/pharmacy.routes';
import billingRoutes from './presentation/routes/billing.routes';
import reportsRoutes from './presentation/routes/reports.routes';
import laborRoutes from './presentation/routes/labor.routes';
import billingConfigRoutes from './presentation/routes/billing-config.routes';
import syncRoutes from './presentation/routes/sync.routes';
import userRoutes from './presentation/routes/user.routes';
import brandingRoutes from './presentation/routes/branding.routes';
import inpatientRoutes from './presentation/routes/inpatient.routes';
import triageRoutes from './presentation/routes/triage.routes';
import auditRoutes from './presentation/routes/audit.routes';
import clinicalRoutes from './presentation/routes/clinical.routes';
import interoperabilityRoutes from './presentation/routes/interoperability.routes';
import outpatientVitalRoutes from './presentation/routes/outpatient-vital.routes';
import verificationRoutes from './presentation/routes/verification.routes';
import insuranceRoutes from './presentation/routes/insurance.routes';
import exemptionRoutes from './presentation/routes/exemption.routes';
import ancRoutes from './presentation/routes/anc.routes';
import immunizationRoutes from './presentation/routes/immunization.routes';
import notificationRoutes from './presentation/routes/notification.routes';
import tenantRoutes from './presentation/routes/tenant.routes';
import fraudPreventionRoutes from './presentation/routes/fraud-prevention.routes';
import { startScheduler, stopScheduler } from './application/services/scheduler.service';
import { handlePaymentWebhook } from './presentation/controllers/payment-webhook.controller';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet());

// CORS configuration — CORS_ORIGIN is a comma-separated allowlist (a clinic
// is reachable by both its LAN IP and hostname, so this needs to support
// more than one). Falls back to reflecting any origin when unset, so local
// dev and any environment that hasn't configured it keep working unchanged.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : true;

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Payment gateway webhooks — must be mounted BEFORE the global JSON body
// parser below, since signature verification needs the raw request bytes,
// not the parsed object. Not behind authMiddleware: gateways aren't
// logged-in users, the signature check inside is the only protection.
app.post('/api/webhooks/payments/:provider', express.raw({ type: '*/*' }), handlePaymentWebhook);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (clinic logos, etc.) — public/no-auth, same as any
// other static asset; filenames are random (see upload.middleware.ts), not
// guessable or tied to sensitive data.
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Audit logging for all authenticated API requests
app.use('/api', auditRequest);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ==================== ROUTES ====================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/billing/config', billingConfigRoutes);
app.use('/api/dashboard', authMiddleware, auditRequest, dashboardRoutes);
app.use('/api/patients', authMiddleware, auditRequest, patientRoutes);
app.use('/api/appointments', authMiddleware, auditRequest, appointmentRoutes);
app.use('/api/consultations', authMiddleware, auditRequest, consultationRoutes);
app.use('/api/prescriptions', authMiddleware, auditRequest, prescriptionRoutes);
app.use('/api/lab', authMiddleware, auditRequest, labRoutes);
app.use('/api/pharmacy', authMiddleware, auditRequest, pharmacyRoutes);
app.use('/api/billing', authMiddleware, auditRequest, billingRoutes);
app.use('/api/reports', authMiddleware, auditRequest, reportsRoutes);
app.use('/api/sync', authMiddleware, auditRequest, syncRoutes);
app.use('/api/users', authMiddleware, auditRequest, userRoutes);
app.use('/api/inpatients', authMiddleware, auditRequest, inpatientRoutes);
app.use('/api/labor', authMiddleware, auditRequest, laborRoutes);
app.use('/api/triage', authMiddleware, auditRequest, triageRoutes);
app.use('/api/audit', authMiddleware, auditRequest, auditRoutes);
app.use('/api/clinical', authMiddleware, auditRequest, clinicalRoutes);
app.use('/api/interoperability', authMiddleware, auditRequest, interoperabilityRoutes);
app.use('/api/outpatient-vitals', authMiddleware, auditRequest, outpatientVitalRoutes);
// Deliberately no authMiddleware — this is the public "scan a QR code on a
// printed document" verification endpoint (verification.routes.ts), used by
// patients/insurers/anyone with no EMR account. It was previously mounted
// behind the global authMiddleware, which meant every external verifier hit
// a 401 before ever reaching the route's own PIN check — the feature never
// actually worked as designed. Protected instead by its own rate limiter.
app.use('/api/verification', auditRequest, verificationRoutes);
app.use('/api/insurance', authMiddleware, auditRequest, insuranceRoutes);
app.use('/api/exemptions', authMiddleware, auditRequest, exemptionRoutes);
app.use('/api/anc', authMiddleware, auditRequest, ancRoutes);
app.use('/api/immunization', authMiddleware, auditRequest, immunizationRoutes);
app.use('/api/notifications', authMiddleware, auditRequest, notificationRoutes);
app.use('/api/tenants', authMiddleware, auditRequest, tenantRoutes);
app.use('/api/fraud-prevention', authMiddleware, auditRequest, fraudPreventionRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Sentry must see errors before our own handler formats/masks them for the
// client — captures message, stack, route, and status code; never the
// request body (see beforeSend in config/sentry.ts).
Sentry.setupExpressErrorHandler(app);

// Error handler (must be last)
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    // Connect to database before starting server
    // Validate critical environment variables
    if (!process.env.JWT_SECRET) {
      logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
      process.exit(1);
    }

    logger.info('🔌 Connecting to database...');
    await connectDatabase();

    startScheduler();

    const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

    // TLS is opt-in via TLS_CERT_PATH/TLS_KEY_PATH so local dev (npm run
    // dev:backend) keeps working over plain HTTP with no cert setup. In
    // production, workstations reach this server over the clinic LAN, not
    // localhost — browsers only allow the service worker (registerSW in
    // main.tsx) to register under a "secure context" (HTTPS or localhost),
    // so LAN deployments need a real cert, e.g. one generated once via
    // mkcert (see CLAUDE.md).
    const certPath = process.env.TLS_CERT_PATH;
    const keyPath = process.env.TLS_KEY_PATH;
    const scheme = certPath && keyPath ? 'https' : 'http';
    const onListening = () => {
      logger.info(`🚀 SSMC EMR Server running on port ${port} (${scheme})`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API: ${scheme}://localhost:${port}/api`);
      logger.info(`❤️  Health Check: ${scheme}://localhost:${port}/health`);
    };

    if (certPath && keyPath) {
      https
        .createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
        .listen(port, '0.0.0.0', onListening);
    } else {
      app.listen(port, '0.0.0.0', onListening);
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  stopScheduler();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  stopScheduler();
  await disconnectDatabase();
  process.exit(0);
});

startServer();

export default app;
