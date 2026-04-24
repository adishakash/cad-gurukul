'use strict';
/**
 * Counsellor onboarding document upload middleware.
 * Stores files locally under /uploads/partners (ephemeral on DO App Platform).
 */
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/partners');
require('fs').mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_MAP = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
};

const ALLOWED_EXTS = new Set(Object.keys(ALLOWED_MIME_MAP));
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB per file

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return cb(new Error(`File type not allowed. Accepted: ${[...ALLOWED_EXTS].join(', ')}`));
  }

  const allowedMimes = ALLOWED_MIME_MAP[ext] || [];
  const reportedMime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (allowedMimes.length > 0 && !allowedMimes.includes(reportedMime)) {
    return cb(new Error(`MIME type '${reportedMime}' does not match extension '${ext}'. Upload rejected.`));
  }

  cb(null, true);
}

const partnerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_DOC_BYTES },
});

module.exports = { partnerUpload, UPLOAD_DIR, MAX_DOC_BYTES };
