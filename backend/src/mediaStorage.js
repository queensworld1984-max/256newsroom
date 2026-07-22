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
const AUDIO_MIME = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg',
  'audio/aac', 'audio/flac', 'audio/x-flac',
]);

function envBytes(name, defaultMb) {
  const mb = Number(process.env[name]);
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
  return defaultMb * 1024 * 1024;
}

const MAX_IMAGE_BYTES = envBytes('MEDIA_MAX_IMAGE_MB', 100);
const MAX_VIDEO_BYTES = envBytes('MEDIA_MAX_VIDEO_MB', 2048);
const MAX_AUDIO_BYTES = envBytes('MEDIA_MAX_AUDIO_MB', 200); // 200 MB audio

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

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
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
};

function ensureUploadDirs() {
  for (const sub of ['images', 'videos', 'audio', 'soundbites']) {
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mediaTypeForMime(mime) {
  const normalized = String(mime || '').toLowerCase().trim();
  if (IMAGE_MIME.has(normalized)) return 'image';
  if (VIDEO_MIME.has(normalized)) return 'video';
  if (AUDIO_MIME.has(normalized)) return 'audio';
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized.startsWith('audio/')) return 'audio';
  return null;
}

function resolveMime(file) {
  const raw = String(file?.mimetype || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream') {
    // Some browsers send audio/mp4 for m4a
    if (raw === 'audio/mp4') return 'audio/mp4';
    return raw;
  }
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
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/wave': '.wav',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/flac': '.flac',
    'audio/x-flac': '.flac',
  };
  return map[String(mime || '').toLowerCase()] || '';
}

function publicUrlFor(publicId, mediaType) {
  const base = (process.env.PUBLIC_BASE_URL || 'https://256newsroom.com').replace(/\/$/, '');
  if (mediaType === 'video') return `${base}/media/watch/${publicId}`;
  if (mediaType === 'audio' || mediaType === 'soundbite') return `${base}/media/listen/${publicId}`;
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

function maxBytesForMediaType(mediaType) {
  if (mediaType === 'video') return MAX_VIDEO_BYTES;
  if (mediaType === 'audio' || mediaType === 'soundbite') return MAX_AUDIO_BYTES;
  return MAX_IMAGE_BYTES;
}

module.exports = {
  UPLOAD_ROOT,
  IMAGE_MIME,
  VIDEO_MIME,
  AUDIO_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_AUDIO_BYTES,
  formatBytes,
  ensureUploadDirs,
  mediaTypeForMime,
  resolveMime,
  extensionForMime,
  publicUrlFor,
  fileUrlFor,
  absoluteStoragePath,
  newPublicId,
  maxBytesForMediaType,
};
