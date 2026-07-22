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

const AUDIO_BITRATE = process.env.AUDIO_COMPRESS_BITRATE || '96k';
const SOUNDBITE_DEFAULT_SECONDS = Number(process.env.SOUNDBITE_DEFAULT_SECONDS || 30);
const SOUNDBITE_MAX_SECONDS = Number(process.env.SOUNDBITE_MAX_SECONDS || 90);

/** Compress audio to mono MP3 for web playback. */
async function compressAudioFile(inputAbsPath, outputAbsPath) {
  fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
  const args = [
    '-y',
    '-i', inputAbsPath,
    '-vn',
    '-ac', '1',
    '-ar', '44100',
    '-c:a', 'libmp3lame',
    '-b:a', AUDIO_BITRATE,
    outputAbsPath,
  ];
  await runFfmpeg(args, 30 * 60 * 1000);
  if (!fs.existsSync(outputAbsPath)) throw new Error('ffmpeg audio output missing.');
  const stat = fs.statSync(outputAbsPath);
  if (stat.size < 500) throw new Error('ffmpeg audio output looks empty.');
  return { outPath: outputAbsPath, sizeBytes: stat.size };
}

/**
 * Create a short sound bite (clip) from full audio or video.
 * durationSeconds: 5–SOUNDBITE_MAX_SECONDS, startSeconds optional.
 */
async function createSoundbiteFile(inputAbsPath, outputAbsPath, {
  durationSeconds = SOUNDBITE_DEFAULT_SECONDS,
  startSeconds = 0,
} = {}) {
  fs.mkdirSync(path.dirname(outputAbsPath), { recursive: true });
  const dur = Math.max(5, Math.min(SOUNDBITE_MAX_SECONDS, Number(durationSeconds) || SOUNDBITE_DEFAULT_SECONDS));
  const start = Math.max(0, Number(startSeconds) || 0);
  const args = [
    '-y',
    '-ss', String(start),
    '-i', inputAbsPath,
    '-t', String(dur),
    '-vn',
    '-ac', '1',
    '-ar', '44100',
    '-c:a', 'libmp3lame',
    '-b:a', AUDIO_BITRATE,
    outputAbsPath,
  ];
  await runFfmpeg(args, 15 * 60 * 1000);
  if (!fs.existsSync(outputAbsPath)) throw new Error('Sound bite file missing after ffmpeg.');
  const stat = fs.statSync(outputAbsPath);
  if (stat.size < 400) throw new Error('Sound bite looks empty.');
  return { outPath: outputAbsPath, sizeBytes: stat.size, durationSeconds: dur, startSeconds: start };
}

function enqueueMediaCompression(mediaAssetId) {
  setImmediate(() => {
    compressMediaAsset(mediaAssetId).catch((err) => {
      console.error('[mediaCompress] unhandled', mediaAssetId, err);
    });
  });
}

// Back-compat alias
function enqueueVideoCompression(mediaAssetId) {
  return enqueueMediaCompression(mediaAssetId);
}

async function compressMediaAsset(mediaAssetId) {
  const { rows } = await pool.query(
    `select id, media_type, storage_path, size_bytes, public_id, mime_type, processing_status
     from media_assets where id = $1`,
    [mediaAssetId],
  );
  const asset = rows[0];
  if (!asset) return;

  if (asset.media_type === 'image' || asset.media_type === 'soundbite') {
    await pool.query(
      `update media_assets set processing_status = 'ready', compressed_at = now() where id = $1`,
      [mediaAssetId],
    );
    return;
  }

  if (asset.media_type !== 'video' && asset.media_type !== 'audio') {
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
      [mediaAssetId, 'Original media file missing on disk.'],
    );
    return;
  }

  const originalSize = fs.statSync(inputAbs).size;
  const isAudio = asset.media_type === 'audio';
  const outExt = isAudio ? '.mp3' : '.mp4';
  const subdir = isAudio ? 'audio' : 'videos';
  const outName = `${asset.public_id}${outExt}`;
  const outRel = path.join(subdir, outName).replace(/\\/g, '/');
  const outAbs = path.join(UPLOAD_ROOT, outRel);
  const tmpAbs = path.join(UPLOAD_ROOT, subdir, `${asset.public_id}.compressing${outExt}`);

  try {
    const { sizeBytes } = isAudio
      ? await compressAudioFile(inputAbs, tmpAbs)
      : await compressVideoFile(inputAbs, tmpAbs);

    const isAlreadyTarget = isAudio
      ? (/\.mp3$/i.test(asset.storage_path) || /mpeg|mp3/i.test(asset.mime_type || ''))
      : (/\.mp4$/i.test(asset.storage_path) || /mp4/i.test(asset.mime_type || ''));
    const improved = sizeBytes < originalSize * 0.95 || !isAlreadyTarget;

    if (!improved) {
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

    if (fs.existsSync(outAbs) && outAbs !== inputAbs) {
      try { fs.unlinkSync(outAbs); } catch { /* ignore */ }
    }
    fs.renameSync(tmpAbs, outAbs);

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
         mime_type = $4,
         size_bytes = $5,
         original_size_bytes = $6,
         compressed_size_bytes = $5,
         url = $7,
         compression_error = null,
         compressed_at = now()
       where id = $1`,
      [
        mediaAssetId,
        outRel,
        asset.storage_path,
        isAudio ? 'audio/mpeg' : 'video/mp4',
        sizeBytes,
        originalSize,
        newUrl,
      ],
    );

    console.log(
      `[mediaCompress] #${mediaAssetId} ${asset.media_type} ${formatBytes(originalSize)} → ${formatBytes(sizeBytes)} (${Math.round((sizeBytes / originalSize) * 100)}%)`,
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
  compressAudioFile,
  createSoundbiteFile,
  enqueueVideoCompression,
  enqueueMediaCompression,
  compressMediaAsset,
  SOUNDBITE_DEFAULT_SECONDS,
  SOUNDBITE_MAX_SECONDS,
  FFMPEG,
  FFPROBE,
};
