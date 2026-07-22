/** Smoke-test ffmpeg compression helper (no HTTP). */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureFfmpeg, compressVideoFile, FFMPEG } = require('../mediaCompress');
const { UPLOAD_ROOT, ensureUploadDirs } = require('../mediaStorage');

(async () => {
  ensureUploadDirs();
  const ok = await ensureFfmpeg();
  console.log('ffmpeg available:', ok, FFMPEG);
  if (!ok) process.exit(1);

  // Generate a 1s test video with ffmpeg
  const src = path.join(UPLOAD_ROOT, 'videos', `_smoke_src_${Date.now()}.mp4`);
  const out = path.join(UPLOAD_ROOT, 'videos', `_smoke_out_${Date.now()}.mp4`);
  const gen = spawnSync(FFMPEG, [
    '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=1',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-shortest', '-c:v', 'libx264', '-t', '1', '-pix_fmt', 'yuv420p', src,
  ], { encoding: 'utf8' });
  if (gen.status !== 0) {
    console.error('generate failed', gen.stderr?.slice(-400));
    process.exit(1);
  }
  console.log('source size', fs.statSync(src).size);
  const result = await compressVideoFile(src, out);
  console.log('compressed', result);
  try { fs.unlinkSync(src); } catch { /* */ }
  try { fs.unlinkSync(out); } catch { /* */ }
  console.log('SMOKE OK');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
