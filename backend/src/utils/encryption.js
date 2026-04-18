'use strict';
/**
 * AES-256-GCM encryption utility for PII fields (bank account numbers).
 *
 * Key: 32-byte hex string from BANK_ACCOUNT_ENCRYPTION_KEY env var.
 * Each encrypt() call generates a unique 12-byte IV; the result is
 * stored as "iv:authTag:ciphertext" (all hex-encoded) so each value
 * is independently decryptable without a shared nonce.
 *
 * Usage:
 *   const { encrypt, decrypt } = require('./encryption');
 *   const enc = encrypt('123456789012');
 *   const plain = decrypt(enc);
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.BANK_ACCOUNT_ENCRYPTION_KEY || '';

// Warn at startup — never throw (startup must succeed even in dev without key)
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.warn(
    '[Encryption] WARNING: BANK_ACCOUNT_ENCRYPTION_KEY is missing or not 64 hex chars. ' +
      'Bank account encryption is DISABLED — all values stored as plaintext. ' +
      'Set a proper key in production.'
  );
}

const getKey = () => (KEY_HEX.length === 64 ? Buffer.from(KEY_HEX, 'hex') : null);

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns "iv:authTag:ciphertext" (hex-encoded) or the original value if no key.
 * @param {string} plaintext
 * @returns {string}
 */
const encrypt = (plaintext) => {
  const key = getKey();
  if (!key) return plaintext; // dev fallback — no key = no encryption

  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

/**
 * Decrypt a value produced by encrypt().
 * Returns the original value unchanged if it does not look encrypted (no key in dev).
 * @param {string} ciphertext  "iv:authTag:data" hex string
 * @returns {string}
 */
const decrypt = (ciphertext) => {
  const key = getKey();
  if (!key) return ciphertext; // dev fallback

  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // not encrypted (legacy or dev)

  const [ivHex, authTagHex, encHex] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

/**
 * Extract last N digits from an account number string (for display masking).
 * @param {string} accountNumber
 * @param {number} n
 * @returns {string}
 */
const lastN = (accountNumber, n = 4) =>
  String(accountNumber).slice(-n);

module.exports = { encrypt, decrypt, lastN };
