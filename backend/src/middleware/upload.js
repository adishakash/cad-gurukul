'use strict';
/**
 * Training file upload middleware.
 *
 * ⚠️  STORAGE WARNING (DigitalOcean App Platform):
 *     Local disk storage is EPHEMERAL — files are wiped on every redeploy.
 *     For production persistence, migrate to DigitalOcean Spaces (S3-compatible)
 *     or mount a persistent volume at /uploads in app spec.
 *     This local approach is suitable for staging / testing only.
 */
const multer = require('multer');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/training');

// Allowed extensions and their corresponding MIME types
// Extension check prevents obvious abuse; MIME check catches renamed files
const ALLOWED_MIME_MAP = {
  '.pdf':  ['application/pdf'],
  '.txt':  ['text/plain', 'text/plain; charset=utf-8'],
  '.epub': ['application/epub+zip'],
  '.doc':  ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.mp4':  ['video/mp4'],
  '.mkv':  ['video/x-matroska', 'video/webm', 'video/x-mkv'],
};

const VIDEO_EXTS   = new Set(['.mp4', '.mkv']);
const DOC_EXTS     = new Set(['.pdf', '.txt', '.epub', '.doc', '.docx']);
const ALLOWED_EXTS = new Set([...VIDEO_EXTS, ...DOC_EXTS]);

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_DOC_BYTES   =  50 * 1024 * 1024; //  50 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Extension must be on the allowlist
  if (!ALLOWED_EXTS.has(ext)) {
    return cb(new Error(`File type not allowed. Accepted: ${[...ALLOWED_EXTS].join(', ')}`));
  }

  // 2. Reported MIME type must match the extension's allowlist
  // Note: file.mimetype is browser-reported; UUID filename removes any executable threat,
  // but rejecting MIME mismatches prevents confusion and common rename attacks.
  const allowedMimes = ALLOWED_MIME_MAP[ext] || [];
  const reportedMime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (allowedMimes.length > 0 && !allowedMimes.includes(reportedMime)) {
    return cb(new Error(`MIME type '${reportedMime}' does not match extension '${ext}'. Upload rejected.`));
  }

  cb(null, true);
}

// Multer instance — no global size limit set here; enforced per-request in limits
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES }, // hard ceiling = video max; doc max enforced below
});

/**
 * After-upload middleware that enforces the smaller document size limit.
 * Videos can be up to 200 MB; documents cap at 50 MB.
 */
function enforceSizeLimit(req, res, next) {
  if (!req.file) return next();
  const ext  = path.extname(req.file.originalname).toLowerCase();
  const size = req.file.size;
  if (DOC_EXTS.has(ext) && size > MAX_DOC_BYTES) {
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: `Document files must be under 50 MB (uploaded: ${(size / 1024 / 1024).toFixed(1)} MB).` },
    });
  }
  next();
}

module.exports = { upload, enforceSizeLimit, UPLOAD_DIR };
