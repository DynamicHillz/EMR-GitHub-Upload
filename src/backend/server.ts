import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import { errorHandler } from './presentation/middleware/errorHandler';
import { authMiddleware } from './presentation/middleware/auth';
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
import billingConfigRoutes from './presentation/routes/billing-config.routes';
import syncRoutes from './presentation/routes/sync.routes';
import userRoutes from './presentation/routes/user.routes';
import brandingRoutes from './presentation/routes/branding.routes';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

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
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);
app.use('/api/appointments', authMiddleware, appointmentRoutes);
app.use('/api/consultations', authMiddleware, consultationRoutes);
app.use('/api/prescriptions', authMiddleware, prescriptionRoutes);
app.use('/api/lab', authMiddleware, labRoutes);
app.use('/api/pharmacy', authMiddleware, pharmacyRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    // Connect to database before starting server
    logger.info('🔌 Connecting to database...');
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`🚀 SSMC EMR Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api`);
      logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

startServer();

export default app;
