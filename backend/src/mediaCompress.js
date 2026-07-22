const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const {
  UPLOAD_ROOT,
  absoluteStoragePath,
  formatBytes,
} = require('./mediaStorage');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

// H.264 / AAC web-friendly defaults. Override via env for heavier/lighter encodes.
const VIDEO_CRF = String(process.env.VIDEO_COMPRESS_CRF || '26');
const VIDEO_PRESET = process.env.VIDEO_COMPRESS_PRESET || 'veryfast';
const VIDEO_MAX_WIDTH = Number(process.env.VIDEO_COMPRESS_MAX_WIDTH || 1280);
const VIDEO_AUDIO_BITRATE = process.env.VIDEO_COMPRESS_AUDIO_BITRATE || '128k';
const COMPRESS_TIMEOUT_MS = Number(process.env.VIDEO_COMPRESS_TIMEOUT_MS || 45 * 60 * 1000); // 45 min

let ffmpegAvailable = null;

function whichFfmpeg() {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-version'], { timeout: 5000 }, (err) => {
      resolve(!err);
    });
  });
}

async function ensureFfmpeg() {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  ffmpegAvailable = await whichFfmpeg();
  if (!ffmpegAvailable) {
    console.warn('[mediaCompress] ffmpeg not found — videos will be stored uncompressed.');
  } else {
    console.log('[mediaCompress] ffmpeg available for video compression.');
  }
  return ffmpegAvailable;
}

function runFfmpeg(args, timeoutMs = COMPRESS_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out after ${Math.round(timeoutMs / 60000)} minutes.`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stderr });
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Compress a video file to H.264 MP4 (web-friendly).
 * Returns { outPath, sizeBytes } of the compressed file.
 */
async function compressVideoFile(inputAbsPath, outputAbsPath) {
  fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });

  // Scale so width <= VIDEO_MAX_WIDTH, keep aspect, even dimensions for yuv420p.
  const scaleFilter = `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`;

  const args = [
    '-y',
    '-i', inputAbsPath,
    '-vf', scaleFilter,
    '-c:v', 'libx264',
    '-preset', VIDEO_PRESET,
    '-crf', VIDEO_CRF,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', VIDEO_AUDIO_BITRATE,
    '-movflags', '+faststart',
    '-max_muxing_queue_size', '1024',
    outputAbsPath,
  ];

  await runFfmpeg(args);

  if (!fs.existsSync(outputAbsPath)) {
    throw new Error('ffmpeg finished but output file is missing.');
  }
  const stat = fs.statSync(outputAbsPath);
  if (stat.size < 1000) {
    throw new Error('ffmpeg output looks empty or corrupt.');
  }
  return { outPath: outputAbsPath, sizeBytes: stat.size };
}

/**
 * Background job: mark processing → compress → swap file → ready.
 * Safe if ffmpeg is missing (marks skipped and keeps original).
 */
function enqueueVideoCompression(mediaAssetId) {
  // Fire-and-forget; errors are written to the row.
  setImmediate(() => {
    compressMediaAsset(mediaAssetId).catch((err) => {
      console.error('[mediaCompress] unhandled', mediaAssetId, err);
    });
  });
}

async function compressMediaAsset(mediaAssetId) {
  const { rows } = await pool.query(
    `select id, media_type, storage_path, size_bytes, public_id, mime_type, processing_status
     from media_assets where id = $1`,
    [mediaAssetId],
  );
  const asset = rows[0];
  if (!asset) return;
  if (asset.media_type !== 'video') {
    await pool.query(
      `update media_assets set processing_status = 'ready', compressed_at = now() where id = $1`,
      [mediaAssetId],
    );
    return;
  }

  const hasFfmpeg = await ensureFfmpeg();
  if (!hasFfmpeg) {
    await pool.query(
      `update media_assets set
         processing_status = 'skipped',
         original_size_bytes = coalesce(original_size_bytes, size_bytes),
         compression_error = 'ffmpeg not installed on server',
         compressed_at = now()
       where id = $1`,
      [mediaAssetId],
    );
    return;
  }

  await pool.query(
    `update media_assets set
       processing_status = 'processing',
       original_size_bytes = coalesce(original_size_bytes, size_bytes),
       compression_error = null
     where id = $1`,
    [mediaAssetId],
  );

  const inputAbs = absoluteStoragePath(asset.storage_path);
  if (!fs.existsSync(inputAbs)) {
    await pool.query(
      `update media_assets set processing_status = 'failed', compression_error = $2 where id = $1`,
      [mediaAssetId, 'Original video file missing on disk.'],
    );
    return;
  }

  const originalSize = fs.statSync(inputAbs).size;
  const outName = `${asset.public_id}.mp4`;
  const outRel = path.join('videos', outName).replace(/\\/g, '/');
  const outAbs = path.join(UPLOAD_ROOT, outRel);
  const tmpAbs = path.join(UPLOAD_ROOT, 'videos', `${asset.public_id}.compressing.mp4`);

  try {
    const { sizeBytes } = await compressVideoFile(inputAbs, tmpAbs);

    // Prefer compressed only if it is meaningfully smaller (or always if source was not mp4).
    const isAlreadyMp4 = /\.mp4$/i.test(asset.storage_path) || /mp4/i.test(asset.mime_type || '');
    const improved = sizeBytes < originalSize * 0.95 || !isAlreadyMp4;

    if (!improved) {
      // Keep original; compressed not worth it
      try { fs.unlinkSync(tmpAbs); } catch { /* ignore */ }
      await pool.query(
        `update media_assets set
           processing_status = 'skipped',
           original_size_bytes = $2,
           compressed_size_bytes = $2,
           compression_error = 'Compressed file was not smaller; kept original',
           compressed_at = now()
         where id = $1`,
        [mediaAssetId, originalSize],
      );
      return;
    }

    // Atomic-ish replace: move tmp → final mp4
    if (fs.existsSync(outAbs) && outAbs !== inputAbs) {
      try { fs.unlinkSync(outAbs); } catch { /* ignore */ }
    }
    fs.renameSync(tmpAbs, outAbs);

    // Remove original if different path
    if (path.resolve(inputAbs) !== path.resolve(outAbs)) {
      try { fs.unlinkSync(inputAbs); } catch { /* keep if locked */ }
    }

    const { fileUrlFor } = require('./mediaStorage');
    const newUrl = fileUrlFor(asset.public_id);

    await pool.query(
      `update media_assets set
         processing_status = 'ready',
         storage_path = $2,
         original_storage_path = $3,
         mime_type = 'video/mp4',
         size_bytes = $4,
         original_size_bytes = $5,
         compressed_size_bytes = $4,
         url = $6,
         compression_error = null,
         compressed_at = now()
       where id = $1`,
      [
        mediaAssetId,
        outRel,
        asset.storage_path,
        sizeBytes,
        originalSize,
        newUrl,
      ],
    );

    console.log(
      `[mediaCompress] #${mediaAssetId} ${formatBytes(originalSize)} → ${formatBytes(sizeBytes)} (${Math.round((sizeBytes / originalSize) * 100)}%)`,
    );
  } catch (err) {
    try { if (fs.existsSync(tmpAbs)) fs.unlinkSync(tmpAbs); } catch { /* ignore */ }
    await pool.query(
      `update media_assets set
         processing_status = 'failed',
         original_size_bytes = $2,
         compression_error = $3,
         compressed_at = now()
       where id = $1`,
      [mediaAssetId, originalSize, String(err.message || err).slice(0, 1000)],
    );
    console.error(`[mediaCompress] failed #${mediaAssetId}`, err.message);
  }
}

module.exports = {
  ensureFfmpeg,
  compressVideoFile,
  enqueueVideoCompression,
  compressMediaAsset,
  FFMPEG,
  FFPROBE,
};
