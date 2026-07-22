const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../auth');
const {
  UPLOAD_ROOT,
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
} = require('../mediaStorage');
const {
  enqueueMediaCompression,
  ensureFfmpeg,
  createSoundbiteFile,
  SOUNDBITE_DEFAULT_SECONDS,
  SOUNDBITE_MAX_SECONDS,
} = require('../mediaCompress');

ensureUploadDirs();
ensureFfmpeg().catch(() => {});

const router = express.Router();

function storageSubdir(mediaType) {
  if (mediaType === 'video') return 'videos';
  if (mediaType === 'audio') return 'audio';
  if (mediaType === 'soundbite') return 'soundbites';
  return 'images';
}

function defaultExt(mediaType) {
  if (mediaType === 'video') return '.mp4';
  if (mediaType === 'audio' || mediaType === 'soundbite') return '.mp3';
  return '.jpg';
}

function storyFieldFor(mediaType) {
  if (mediaType === 'video') return 'videoUrl';
  if (mediaType === 'audio') return 'audioUrl';
  if (mediaType === 'soundbite') return 'soundbiteUrl';
  return 'imageUrl';
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    if (!mediaType) {
      return cb(new Error(
        'Unsupported file type. Attach a photo (JPEG/PNG/WebP/GIF/HEIC), video (MP4/WebM/MOV), or audio (MP3/M4A/WAV/OGG/AAC/FLAC) from your device.',
      ));
    }
    file.mimetype = mime || file.mimetype;
    const dir = path.join(UPLOAD_ROOT, storageSubdir(mediaType));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    const publicId = newPublicId();
    const ext = extensionForMime(mime)
      || path.extname(file.originalname || '').slice(0, 10)
      || defaultExt(mediaType);
    req._uploadPublicId = publicId;
    req._uploadMediaType = mediaType;
    req._uploadMime = mime;
    cb(null, `${publicId}${ext}`);
  },
});

const upload = multer({
  storage,
  // Use the larger video ceiling so big phone photos/clips are not
  // rejected by multer before our type-specific checks run.
  limits: { fileSize: MAX_VIDEO_BYTES, fieldSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    if (!mediaType) {
      return cb(new Error(
        'Only photos, videos, and audio from your device are allowed (JPEG, PNG, WebP, GIF, HEIC, MP4, WebM, MOV, MP3, M4A, WAV, OGG, AAC, FLAC).',
      ));
    }
    file.mimetype = mime || file.mimetype;
    cb(null, true);
  },
});

function canUseOrg(req, orgId) {
  if (!orgId) return true;
  if (req.user.roles.some((r) => ['super_admin', 'newsroom_admin'].includes(r.key))) return true;
  return req.user.roles.some((r) => Number(r.organizationId) === Number(orgId));
}

function canAccessAsset(req, asset) {
  const isOwner = Number(asset.owner_user_id) === Number(req.user.id);
  const isAdmin = req.user.roles.some((r) => ['super_admin', 'newsroom_admin'].includes(r.key));
  const isOrgMember = asset.organization_id
    && req.user.roles.some((r) => Number(r.organizationId) === Number(asset.organization_id));
  return isOwner || isAdmin || isOrgMember;
}

// Shared upload for org members and independent journalists.
// multipart field name: "file"
// optional form fields: caption, credit, altText, organizationId
router.post(
  '/upload',
  requireAuth,
  requireRole('independent_journalist', 'publisher_owner', 'publisher_editor', 'journalist', 'super_admin', 'newsroom_admin'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File is too large. Photos up to ${formatBytes(MAX_IMAGE_BYTES)}, audio up to ${formatBytes(MAX_AUDIO_BYTES)}, videos up to ${formatBytes(MAX_VIDEO_BYTES)}.`,
          });
        }
        return res.status(400).json({ error: err.message || 'Upload failed.' });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose a file from your device to attach.' });

      const mediaType = req._uploadMediaType || mediaTypeForMime(resolveMime(req.file));
      if (mediaType === 'image' && req.file.size > MAX_IMAGE_BYTES) {
        fs.unlink(req.file.path, () => {});
        return res.status(413).json({
          error: `Photo is too large (${formatBytes(req.file.size)}). Maximum is ${formatBytes(MAX_IMAGE_BYTES)}.`,
        });
      }
      if (mediaType === 'video' && req.file.size > MAX_VIDEO_BYTES) {
        fs.unlink(req.file.path, () => {});
        return res.status(413).json({
          error: `Video is too large (${formatBytes(req.file.size)}). Maximum is ${formatBytes(MAX_VIDEO_BYTES)}.`,
        });
      }
      if (mediaType === 'audio' && req.file.size > MAX_AUDIO_BYTES) {
        fs.unlink(req.file.path, () => {});
        return res.status(413).json({
          error: `Audio is too large (${formatBytes(req.file.size)}). Maximum is ${formatBytes(MAX_AUDIO_BYTES)}.`,
        });
      }
      const storedMime = req._uploadMime || resolveMime(req.file) || req.file.mimetype;

      const organizationId = req.body.organizationId ? Number(req.body.organizationId) : null;
      if (organizationId && !canUseOrg(req, organizationId)) {
        fs.unlink(req.file.path, () => {});
        return res.status(403).json({ error: 'You are not a member of that organization.' });
      }
      // Independents should not attach org media unless they also hold an org role.
      if (!organizationId) {
        const isIndependent = req.user.roles.some((r) => r.key === 'independent_journalist')
          || req.user.roles.some((r) => ['super_admin', 'newsroom_admin'].includes(r.key));
        if (!isIndependent && !req.user.roles.some((r) => r.organizationId)) {
          fs.unlink(req.file.path, () => {});
          return res.status(403).json({ error: 'No authoring role for media uploads.' });
        }
      }

      const publicId = req._uploadPublicId;
      const storagePath = path.relative(UPLOAD_ROOT, req.file.path).replace(/\\/g, '/');
      const fileUrl = fileUrlFor(publicId);
      const shareUrl = publicUrlFor(publicId, mediaType);

      // Videos and audio start as "processing" while ffmpeg compresses in the background.
      // Images are ready immediately.
      const needsCompress = mediaType === 'video' || mediaType === 'audio';
      const processingStatus = needsCompress ? 'processing' : 'ready';

      const { rows } = await pool.query(
        `insert into media_assets
          (organization_id, owner_user_id, url, caption, credit, alt_text, added_by_user_id,
           media_type, public_id, storage_path, mime_type, size_bytes, original_filename,
           processing_status, original_size_bytes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$10,$11,$12,$13,$14,$12)
         returning *`,
        [
          organizationId,
          req.user.id,
          fileUrl,
          req.body.caption ? String(req.body.caption).slice(0, 300) : null,
          req.body.credit ? String(req.body.credit).slice(0, 200) : null,
          req.body.altText ? String(req.body.altText).slice(0, 300) : null,
          req.user.id,
          mediaType,
          publicId,
          storagePath,
          storedMime,
          req.file.size,
          String(req.file.originalname || '').slice(0, 255) || null,
          processingStatus,
        ],
      );

      if (needsCompress) {
        enqueueMediaCompression(rows[0].id);
      }

      const typeLabel = mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Audio' : 'Photo';
      res.status(201).json({
        item: rows[0],
        url: fileUrl,
        shareUrl,
        mediaType,
        processingStatus,
        compressing: needsCompress,
        storyField: storyFieldFor(mediaType),
        message: needsCompress
          ? `${typeLabel} received. Compressing for faster playback — this may take a minute.`
          : 'Upload complete.',
      });
    } catch (err) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      next(err);
    }
  },
);

/**
 * Create a short sound bite (clip) from an existing audio or video media asset.
 * Body: { publicId | mediaId, startSeconds?, durationSeconds?, caption?, organizationId? }
 */
router.post(
  '/soundbite',
  requireAuth,
  requireRole('independent_journalist', 'publisher_owner', 'publisher_editor', 'journalist', 'super_admin', 'newsroom_admin'),
  async (req, res, next) => {
    try {
      const publicId = req.body.publicId ? String(req.body.publicId).trim() : null;
      const mediaId = req.body.mediaId ? Number(req.body.mediaId) : null;
      if (!publicId && !mediaId) {
        return res.status(400).json({ error: 'Provide publicId or mediaId of the source audio/video.' });
      }

      const { rows: sourceRows } = await pool.query(
        publicId
          ? `select * from media_assets where public_id = $1`
          : `select * from media_assets where id = $1`,
        [publicId || mediaId],
      );
      const source = sourceRows[0];
      if (!source) return res.status(404).json({ error: 'Source media not found.' });
      if (source.media_type !== 'audio' && source.media_type !== 'video') {
        return res.status(400).json({ error: 'Sound bites can only be created from audio or video files.' });
      }
      if (!canAccessAsset(req, source)) {
        return res.status(403).json({ error: 'Forbidden.' });
      }

      const abs = absoluteStoragePath(source.storage_path);
      if (!abs || !fs.existsSync(abs)) {
        return res.status(404).json({ error: 'Source media file missing on disk.' });
      }

      const hasFfmpeg = await ensureFfmpeg();
      if (!hasFfmpeg) {
        return res.status(503).json({ error: 'Audio processing is not available on this server (ffmpeg missing).' });
      }

      let durationSeconds = Number(req.body.durationSeconds);
      if (!Number.isFinite(durationSeconds)) durationSeconds = SOUNDBITE_DEFAULT_SECONDS;
      durationSeconds = Math.max(5, Math.min(SOUNDBITE_MAX_SECONDS, durationSeconds));
      let startSeconds = Number(req.body.startSeconds);
      if (!Number.isFinite(startSeconds) || startSeconds < 0) startSeconds = 0;

      const bitePublicId = newPublicId();
      const outRel = path.join('soundbites', `${bitePublicId}.mp3`).replace(/\\/g, '/');
      const outAbs = path.join(UPLOAD_ROOT, outRel);
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });

      const { sizeBytes, durationSeconds: dur } = await createSoundbiteFile(abs, outAbs, {
        durationSeconds,
        startSeconds,
      });

      const organizationId = req.body.organizationId != null && req.body.organizationId !== ''
        ? Number(req.body.organizationId)
        : source.organization_id;
      if (organizationId && !canUseOrg(req, organizationId)) {
        try { fs.unlinkSync(outAbs); } catch { /* ignore */ }
        return res.status(403).json({ error: 'You are not a member of that organization.' });
      }

      const fileUrl = fileUrlFor(bitePublicId);
      const shareUrl = publicUrlFor(bitePublicId, 'soundbite');
      const caption = req.body.caption
        ? String(req.body.caption).slice(0, 300)
        : (source.caption ? `Sound bite: ${String(source.caption).slice(0, 250)}` : 'Sound bite');

      const { rows } = await pool.query(
        `insert into media_assets
          (organization_id, owner_user_id, url, caption, credit, alt_text, added_by_user_id,
           media_type, public_id, storage_path, mime_type, size_bytes, original_filename,
           processing_status, original_size_bytes, parent_media_id, duration_seconds)
         values ($1,$2,$3,$4,$5,$6,$7,'soundbite',$8::uuid,$9,'audio/mpeg',$10,$11,'ready',$10,$12,$13)
         returning *`,
        [
          organizationId,
          req.user.id,
          fileUrl,
          caption,
          source.credit || null,
          req.body.altText ? String(req.body.altText).slice(0, 300) : null,
          req.user.id,
          bitePublicId,
          outRel,
          sizeBytes,
          `soundbite-${dur}s.mp3`,
          source.id,
          dur,
        ],
      );

      res.status(201).json({
        item: rows[0],
        url: fileUrl,
        shareUrl,
        mediaType: 'soundbite',
        processingStatus: 'ready',
        storyField: 'soundbiteUrl',
        durationSeconds: dur,
        startSeconds,
        message: `Sound bite created (${dur}s). Attach it to your story and save.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Poll compression status (authenticated owner / org member / admin)
router.get('/status/:publicId', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id, public_id, media_type, processing_status, url, size_bytes,
              original_size_bytes, compressed_size_bytes, compression_error,
              mime_type, original_filename, owner_user_id, organization_id, compressed_at,
              duration_seconds, parent_media_id
       from media_assets where public_id = $1`,
      [req.params.publicId],
    );
    const asset = rows[0];
    if (!asset) return res.status(404).json({ error: 'Media not found.' });
    if (!canAccessAsset(req, asset)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const original = Number(asset.original_size_bytes || asset.size_bytes || 0);
    const compressed = Number(asset.compressed_size_bytes || 0);
    const ratio = original && compressed
      ? Math.round((compressed / original) * 100)
      : null;

    res.json({
      publicId: asset.public_id,
      mediaType: asset.media_type,
      processingStatus: asset.processing_status,
      ready: asset.processing_status === 'ready' || asset.processing_status === 'skipped',
      failed: asset.processing_status === 'failed',
      url: asset.url,
      shareUrl: publicUrlFor(asset.public_id, asset.media_type),
      sizeBytes: asset.size_bytes,
      originalSizeBytes: asset.original_size_bytes,
      compressedSizeBytes: asset.compressed_size_bytes,
      compressionRatioPercent: ratio,
      compressionError: asset.compression_error,
      compressedAt: asset.compressed_at,
      durationSeconds: asset.duration_seconds,
      parentMediaId: asset.parent_media_id,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const organizationId = req.query.organizationId ? Number(req.query.organizationId) : null;
    let rows;
    if (organizationId) {
      if (!canUseOrg(req, organizationId)) return res.status(403).json({ error: 'Forbidden.' });
      ({ rows } = await pool.query(
        `select * from media_assets where organization_id = $1 order by created_at desc limit 200`,
        [organizationId],
      ));
    } else {
      ({ rows } = await pool.query(
        `select * from media_assets
         where owner_user_id = $1 and organization_id is null
         order by created_at desc limit 200`,
        [req.user.id],
      ));
    }
    res.json({
      items: rows.map((row) => ({
        ...row,
        shareUrl: publicUrlFor(row.public_id, row.media_type),
        fileUrl: row.url,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Public file bytes (images + raw video/audio stream)
router.get('/file/:publicId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select storage_path, mime_type, original_filename, media_type from media_assets where public_id = $1',
      [req.params.publicId],
    );
    const asset = rows[0];
    if (!asset?.storage_path) return res.status(404).json({ error: 'Media not found.' });
    const abs = absoluteStoragePath(asset.storage_path);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Media file missing on disk.' });
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (asset.original_filename) {
      res.setHeader('Content-Disposition', `inline; filename="${asset.original_filename.replace(/"/g, '')}"`);
    }
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

// YouTube-style watch page for uploaded videos
router.get('/watch/:publicId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select public_id, url, caption, credit, mime_type, original_filename, media_type, created_at
       from media_assets where public_id = $1`,
      [req.params.publicId],
    );
    const asset = rows[0];
    if (!asset || asset.media_type !== 'video') return res.status(404).send('Video not found.');

    const fileUrl = fileUrlFor(asset.public_id);
    const title = asset.caption || asset.original_filename || '256 Newsroom video';
    const safeTitle = String(title).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — 256 Newsroom</title>
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:type" content="video.other">
  <meta property="og:video" content="${fileUrl}">
  <style>
    body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:system-ui,sans-serif}
    .wrap{max-width:960px;margin:0 auto;padding:24px 16px}
    video{width:100%;max-height:80vh;background:#000}
    h1{font-size:1.25rem;margin:16px 0 6px}
    p{color:#aaa;margin:0;font-size:.9rem}
    a{color:#c99a2e}
  </style>
</head>
<body>
  <div class="wrap">
    <video controls playsinline preload="metadata" src="${fileUrl}"></video>
    <h1>${safeTitle}</h1>
    <p>${asset.credit ? `Credit: ${String(asset.credit).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))} · ` : ''}
      <a href="${fileUrl}">Direct file</a> ·
      <a href="https://256newsroom.com">256 Newsroom</a>
    </p>
  </div>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

// Listen page for uploaded audio and sound bites
router.get('/listen/:publicId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select public_id, url, caption, credit, mime_type, original_filename, media_type,
              duration_seconds, created_at
       from media_assets where public_id = $1`,
      [req.params.publicId],
    );
    const asset = rows[0];
    if (!asset || (asset.media_type !== 'audio' && asset.media_type !== 'soundbite')) {
      return res.status(404).send('Audio not found.');
    }

    const fileUrl = fileUrlFor(asset.public_id);
    const kindLabel = asset.media_type === 'soundbite' ? 'Sound bite' : 'Audio';
    const title = asset.caption || asset.original_filename || `256 Newsroom ${kindLabel.toLowerCase()}`;
    const safeTitle = String(title).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const dur = asset.duration_seconds ? ` · ${Number(asset.duration_seconds).toFixed(0)}s` : '';

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle} — 256 Newsroom</title>
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:type" content="music.song">
  <meta property="og:audio" content="${fileUrl}">
  <style>
    body{margin:0;background:#0b0b0b;color:#f5f5f5;font-family:system-ui,sans-serif}
    .wrap{max-width:640px;margin:0 auto;padding:40px 16px}
    .badge{display:inline-block;background:#c99a2e;color:#111;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;margin-bottom:12px}
    audio{width:100%;margin:20px 0}
    h1{font-size:1.35rem;margin:0 0 8px;line-height:1.3}
    p{color:#aaa;margin:0;font-size:.9rem}
    a{color:#c99a2e}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">${kindLabel}${dur}</div>
    <h1>${safeTitle}</h1>
    <audio controls preload="metadata" src="${fileUrl}"></audio>
    <p>${asset.credit ? `Credit: ${String(asset.credit).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))} · ` : ''}
      <a href="${fileUrl}">Direct file</a> ·
      <a href="https://256newsroom.com">256 Newsroom</a>
    </p>
  </div>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
