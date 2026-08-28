'use strict';

const crypto = require('crypto');

const DEFAULT_PASSWORD = 'relax123';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, record) {
  if (!record || !record.hash || !record.salt) return false;
  const candidate = crypto.scryptSync(password, record.salt, 64);
  const stored = Buffer.from(record.hash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { DEFAULT_PASSWORD, TOKEN_TTL_MS, hashPassword, verifyPassword, newToken };
