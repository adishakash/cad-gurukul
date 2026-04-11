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
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── General Rate Limiting ────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Trust proxy (for correct IP behind reverse proxy / deployment) ───────────
app.set('trust proxy', 1);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 & Error Handlers (must be last) ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
