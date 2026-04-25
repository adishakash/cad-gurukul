'use strict';
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');
const logger = require('./logger');

const normalizePrefix = (prefix) => (prefix || '').replace(/^\/+|\/+$/g, '');

const isSpacesEnabled = () => {
  const spaces = config.spaces || {};
  return Boolean(
    spaces.enabled &&
    spaces.bucket &&
    spaces.accessKeyId &&
    spaces.secretAccessKey &&
    spaces.endpoint
  );
};

const getSpacesClient = (() => {
  let client = null;
  return () => {
    if (client) return client;
    const spaces = config.spaces || {};
    client = new S3Client({
      region: spaces.region || 'us-east-1',
      endpoint: spaces.endpoint,
      credentials: {
        accessKeyId: spaces.accessKeyId,
        secretAccessKey: spaces.secretAccessKey,
      },
    });
    return client;
  };
})();

const isSpacesStoragePath = (storagePath) => typeof storagePath === 'string' && storagePath.startsWith('spaces:');

const stripSpacesStoragePath = (storagePath) => storagePath.replace(/^spaces:/, '');

const toSpacesStoragePath = (key) => `spaces:${key}`;

const buildTrainingKey = (filename) => {
  const prefix = normalizePrefix((config.spaces && config.spaces.prefix) || 'training');
  return prefix ? `${prefix}/${filename}` : filename;
};

const uploadTrainingFileFromDisk = async ({ localPath, filename, contentType }) => {
  if (!isSpacesEnabled()) {
    throw new Error('Spaces is not configured');
  }

  const spaces = config.spaces || {};
  const key = buildTrainingKey(filename);
  const body = fs.createReadStream(localPath);

  await getSpacesClient().send(new PutObjectCommand({
    Bucket: spaces.bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  }));

  return key;
};

const getTrainingObjectStream = async (key) => {
  if (!isSpacesEnabled()) {
    throw new Error('Spaces is not configured');
  }

  const spaces = config.spaces || {};
  const data = await getSpacesClient().send(new GetObjectCommand({
    Bucket: spaces.bucket,
    Key: key,
  }));

  return {
    stream: data.Body,
    contentLength: data.ContentLength,
    contentType: data.ContentType,
  };
};

const getSignedTrainingUrl = async ({ key, contentType, contentDisposition }) => {
  if (!isSpacesEnabled()) {
    throw new Error('Spaces is not configured');
  }

  const spaces = config.spaces || {};
  const command = new GetObjectCommand({
    Bucket: spaces.bucket,
    Key: key,
    ResponseContentType: contentType || 'application/octet-stream',
    ResponseContentDisposition: contentDisposition,
  });

  const expiresIn = Number.isFinite(spaces.signedUrlExpiresSeconds)
    ? spaces.signedUrlExpiresSeconds
    : 300;

  return getSignedUrl(getSpacesClient(), command, { expiresIn });
};

const shouldRedirectSpacesDownloads = () => {
  const delivery = (config.spaces && config.spaces.delivery) || 'stream';
  return delivery.toLowerCase() === 'redirect';
};

const getSafeDownloadName = (title, storagePath, originalFilename) => {
  const safeTitle = (title || 'training-file').replace(/[^a-zA-Z0-9\-_.]/g, '_');
  const ext = path.extname(originalFilename || storagePath || '') || '';
  return `${safeTitle}${ext}`;
};

const deleteLocalFileQuietly = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    logger.warn('[Spaces] Failed to delete local upload', { error: err.message, filePath });
  }
};

module.exports = {
  isSpacesEnabled,
  isSpacesStoragePath,
  stripSpacesStoragePath,
  toSpacesStoragePath,
  uploadTrainingFileFromDisk,
  getTrainingObjectStream,
  getSignedTrainingUrl,
  shouldRedirectSpacesDownloads,
  getSafeDownloadName,
  deleteLocalFileQuietly,
};
