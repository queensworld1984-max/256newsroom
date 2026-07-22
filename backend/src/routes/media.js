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

ensureUploadDirs();

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    if (!mediaType) return cb(new Error('Unsupported file type. Attach a photo (JPEG/PNG/WebP/GIF/HEIC) or video (MP4/WebM/MOV) from your device.'));
    file.mimetype = mime || file.mimetype;
    const dir = path.join(UPLOAD_ROOT, mediaType === 'video' ? 'videos' : 'images');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    const publicId = newPublicId();
    const ext = extensionForMime(mime) || path.extname(file.originalname || '').slice(0, 10) || (mediaType === 'video' ? '.mp4' : '.jpg');
    req._uploadPublicId = publicId;
    req._uploadMediaType = mediaType;
    req._uploadMime = mime;
    cb(null, `${publicId}${ext}`);
  },
});

const upload = multer({
  storage,
  // Use the larger video ceiling so big phone photos and long clips are not
  // rejected by multer before our type-specific checks run.
  limits: { fileSize: MAX_VIDEO_BYTES, fieldSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const mime = resolveMime(file);
    const mediaType = mediaTypeForMime(mime);
    if (!mediaType) {
      return cb(new Error('Only photos and videos from your device are allowed (JPEG, PNG, WebP, GIF, HEIC, MP4, WebM, MOV).'));
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
            error: `File is too large. Photos up to ${formatBytes(MAX_IMAGE_BYTES)}, videos up to ${formatBytes(MAX_VIDEO_BYTES)}.`,
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

      const { rows } = await pool.query(
        `insert into media_assets
          (organization_id, owner_user_id, url, caption, credit, alt_text, added_by_user_id,
           media_type, public_id, storage_path, mime_type, size_bytes, original_filename)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::uuid,$10,$11,$12,$13)
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
        ],
      );

      res.status(201).json({
        item: rows[0],
        url: fileUrl,
        shareUrl,
        mediaType,
        // Convenience for story form: images go into imageUrl, videos into videoUrl
        storyField: mediaType === 'video' ? 'videoUrl' : 'imageUrl',
      });
    } catch (err) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      next(err);
    }
  },
);

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

// Public file bytes (images + raw video stream)
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

module.exports = router;
