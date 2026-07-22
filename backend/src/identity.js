const crypto = require('crypto');

// Uganda NIN patterns commonly seen: 14-char alphanumeric (e.g. CM900... / CF900...)
// Accept a practical range so diaspora IDs / passports can also be recorded when needed.
function normalizeNationalId(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '');
}

function isPlausibleNationalId(normalized) {
  if (!normalized) return false;
  if (normalized.length < 8 || normalized.length > 20) return false;
  return /^[A-Z0-9]+$/.test(normalized);
}

function hashNationalId(normalized) {
  const salt = process.env.NATIONAL_ID_PEPPER || '256newsroom-nin-pepper-change-me';
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

function nationalIdLast4(normalized) {
  return normalized.slice(-4);
}

function cleanPhone(raw) {
  const value = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (!value) return null;
  if (value.length < 9 || value.length > 20) return false;
  return value;
}

function cleanEmail(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  return value.slice(0, 200);
}

function cleanUrl(raw) {
  const value = String(raw || '').trim().slice(0, 500);
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return false;
  return value;
}

module.exports = {
  normalizeNationalId,
  isPlausibleNationalId,
  hashNationalId,
  nationalIdLast4,
  cleanPhone,
  cleanEmail,
  cleanUrl,
};
