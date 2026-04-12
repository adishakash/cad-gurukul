'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { requestLogger } = require('./middleware/requestLogger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');
const config = require('./config');

const app = express();

// ─── Trust Proxy (must be FIRST – before rate limiters & IP-dependent middleware) ──
app.set('trust proxy', 1);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const ALLOWED_ORIGINS = [
  'https://cadgurukul.com',
  'https://www.cadgurukul.com',
  ...(config.frontendUrl ? [config.frontendUrl] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl requests with no Origin header
    if (!origin) return callback(null, true);
    // Allow any subdomain of cadgurukul.com  (e.g. app.cadgurukul.com)
    if (/^https:\/\/([a-z0-9-]+\.)*cadgurukul\.com$/.test(origin)) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Request Timeout (prevent hung DB queries returning "No Response") ─────────
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(503).json({
      success: false,
      error: { code: 'TIMEOUT', message: 'Request timed out. Please try again.' },
    });
  });
  next();
});

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Razorpay webhook needs raw body for signature verification.
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── General Rate Limiting ────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 & Error Handlers (must be last) ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
