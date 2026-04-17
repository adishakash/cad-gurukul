'use strict';
const express = require('express');
const path    = require('path');
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

const ALLOWED_ORIGINS = new Set([
  'https://cadgurukul.com',
  'https://www.cadgurukul.com',
  ...(Array.isArray(config.frontendUrls) ? config.frontendUrls : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl requests with no Origin header
    if (!origin) return callback(null, true);
    // Allow any subdomain of cadgurukul.com  (e.g. app.cadgurukul.com)
    if (/^https:\/\/([a-z0-9-]+\.)*cadgurukul\.com$/.test(origin)) {
      return callback(null, true);
    }
    if (config.allowDigitalOceanPreviewOrigins && /^https:\/\/([a-z0-9-]+\.)*ondigitalocean\.app$/.test(origin)) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.has(origin)) {
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

// ─── Static File Serving ──────────────────────────────────────────────────────
// ⚠️  Training files are NOT served as public static assets.
//     All file access goes through authenticated API routes:
//       GET /api/v1/staff/training/:id/file       (CCL)
//       GET /api/v1/counsellor/training/:id/file  (CC)
//     These routes enforce role-based access and the isDownloadable flag.
//     Direct /uploads/* requests are intentionally not served.

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 & Error Handlers (must be last) ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
