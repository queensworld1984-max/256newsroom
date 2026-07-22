const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = process.env.MEDIA_UPLOAD_DIR
  || path.join(__dirname, '../uploads');

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

function ensureUploadDirs() {
  for (const sub of ['images', 'videos']) {
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mediaTypeForMime(mime) {
  if (IMAGE_MIME.has(mime)) return 'image';
  if (VIDEO_MIME.has(mime)) return 'video';
  return null;
}

function extensionForMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[mime] || '';
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
  extensionForMime,
  publicUrlFor,
  fileUrlFor,
  absoluteStoragePath,
  newPublicId,
};
