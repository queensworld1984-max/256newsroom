const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = process.env.MEDIA_UPLOAD_DIR
  || path.join(__dirname, '../uploads');

// Includes HEIC/HEIF so iPhone gallery photos can be attached directly.
const IMAGE_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/pjpeg',
  'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
]);
const VIDEO_MIME = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp',
]);

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.3gp': 'video/3gpp',
};

function ensureUploadDirs() {
  for (const sub of ['images', 'videos']) {
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mediaTypeForMime(mime) {
  const normalized = String(mime || '').toLowerCase().trim();
  if (IMAGE_MIME.has(normalized)) return 'image';
  if (VIDEO_MIME.has(normalized)) return 'video';
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return null;
}

/** Some mobile browsers send empty or generic MIME types — fall back to extension. */
function resolveMime(file) {
  const raw = String(file?.mimetype || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream') return raw;
  const ext = path.extname(file?.originalname || '').toLowerCase();
  return EXT_TO_MIME[ext] || raw || '';
}

function extensionForMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/pjpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/heic-sequence': '.heic',
    'image/heif-sequence': '.heif',
    'video/mp4': '.mp4',
    'video/x-m4v': '.m4v',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/3gpp': '.3gp',
  };
  return map[String(mime || '').toLowerCase()] || '';
}

function publicUrlFor(publicId, mediaType) {
  const base = (process.env.PUBLIC_BASE_URL || 'https://256newsroom.com').replace(/\/$/, '');
  // Videos get a YouTube-style watch page; images serve the file directly.
  if (mediaType === 'video') return `${base}/media/watch/${publicId}`;
  return `${base}/media/file/${publicId}`;
}

function fileUrlFor(publicId) {
  const base = (process.env.PUBLIC_BASE_URL || 'https://256newsroom.com').replace(/\/$/, '');
  return `${base}/media/file/${publicId}`;
}

function absoluteStoragePath(storagePath) {
  return path.join(UPLOAD_ROOT, storagePath);
}

function newPublicId() {
  return crypto.randomUUID();
}

module.exports = {
  UPLOAD_ROOT,
  IMAGE_MIME,
  VIDEO_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  ensureUploadDirs,
  mediaTypeForMime,
  resolveMime,
  extensionForMime,
  publicUrlFor,
  fileUrlFor,
  absoluteStoragePath,
  newPublicId,
};
