/**
 * EcoTrack Backend - Cloud Run Entry Point
 * Carbon Footprint Awareness Platform API
 */

'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { logger } = require('./config/logger');
const { initFirebase } = require('./config/firebase');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');

// Routes
const activitiesRouter = require('./routes/activities');
const insightsRouter = require('./routes/insights');
const goalsRouter = require('./routes/goals');
const analyticsRouter = require('./routes/analytics');
const reportsRouter = require('./routes/reports');
const usersRouter = require('./routes/users');
const gamificationRouter = require('./routes/gamification');
const authRouter = require('./routes/auth');
const healthRouter = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Initialize GCP Services ───────────────────────────────────────────────
initFirebase();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ─── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id'],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts.' },
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// ─── Parsing & Compression ──────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Logging ────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Health Check (no auth) ─────────────────────────────────────────────────
app.use('/health', healthRouter);

// ─── Auth (public) ──────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);

// ─── API Routes (auth required; guest only if ALLOW_GUEST_ACCESS=true) ───────
const protect = process.env.ALLOW_GUEST_ACCESS === 'true' ? optionalAuthMiddleware : authMiddleware;

app.use('/api/v1/users', protect, usersRouter);
app.use('/api/v1/activities', protect, activitiesRouter);
app.use('/api/v1/insights', protect, insightsRouter);
app.use('/api/v1/goals', protect, goalsRouter);
app.use('/api/v1/analytics', protect, analyticsRouter);
app.use('/api/v1/reports', protect, reportsRouter);
app.use('/api/v1/gamification', protect, gamificationRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found', path: req.path });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`carbon-footprint-api running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

// Graceful shutdown for Cloud Run
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;
