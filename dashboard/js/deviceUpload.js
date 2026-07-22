import { ApiError, api, uploadFile } from './api.js';
import { el } from './util.js';

// Keep in sync with backend defaults (MEDIA_MAX_IMAGE_MB / MEDIA_MAX_VIDEO_MB).
const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_VIDEO_BYTES = 2048 * 1024 * 1024; // 2 GB

/**
 * Device-first media picker: opens the phone/computer file picker (gallery)
 * or camera, uploads immediately (including large files), returns public URLs.
 * Videos are compressed server-side after upload; this UI polls until ready.
 *
 * @param {object} opts
 * @param {'image'|'video'|'both'} opts.kind
 * @param {number|null} [opts.organizationId]
 * @param {(result: {url:string, shareUrl:string, mediaType:string, item?:object}) => void} opts.onUploaded
 * @param {string} [opts.label]
 */
export function buildDeviceAttach(opts) {
  const kind = opts.kind || 'image';
  const wrap = el('div', { class: 'device-attach' });

  const preview = el('div', { class: 'device-attach-preview', hidden: true });
  const previewImg = el('img', { alt: 'Selected media preview' });
  const previewVideo = el('video', { controls: true, playsinline: 'true' });
  preview.appendChild(previewImg);
  preview.appendChild(previewVideo);
  previewImg.hidden = true;
  previewVideo.hidden = true;

  const progressWrap = el('div', { class: 'device-upload-progress', hidden: true });
  const progressBar = el('div', { class: 'device-upload-progress-bar' });
  progressWrap.appendChild(progressBar);

  const status = el('p', { class: 'device-attach-status' });
  const limits = el('p', {
    class: 'device-attach-limits',
    text: kind === 'video'
      ? `Videos up to ${formatBytes(MAX_VIDEO_BYTES)}. Server compresses after upload for faster playback.`
      : kind === 'both'
        ? `Photos up to ${formatBytes(MAX_IMAGE_BYTES)}, videos up to ${formatBytes(MAX_VIDEO_BYTES)}. Videos are auto-compressed on the server.`
        : `Photos up to ${formatBytes(MAX_IMAGE_BYTES)}.`,
  });

  const galleryInput = el('input', {
    type: 'file',
    class: 'device-file-input',
    accept: acceptFor(kind),
  });
  galleryInput.setAttribute('aria-label', 'Choose from device');

  const cameraInput = el('input', {
    type: 'file',
    class: 'device-file-input',
    accept: kind === 'video' ? 'video/*' : 'image/*',
  });
  if (kind !== 'video') cameraInput.setAttribute('capture', 'environment');
  cameraInput.setAttribute('aria-label', 'Take with camera');

  const actions = el('div', { class: 'device-attach-actions' });
  const galleryBtn = el('button', {
    type: 'button',
    class: 'device-pick-btn',
    text: opts.label || (kind === 'video' ? 'Attach video from device' : 'Attach photo from device'),
  });
  const cameraBtn = kind === 'video'
    ? null
    : el('button', { type: 'button', class: 'secondary device-camera-btn', text: 'Take photo' });

  actions.appendChild(galleryBtn);
  if (cameraBtn) actions.appendChild(cameraBtn);

  galleryBtn.addEventListener('click', () => galleryInput.click());
  if (cameraBtn) cameraBtn.addEventListener('click', () => cameraInput.click());

  async function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;

    const isVideo = isVideoFile(file);
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      status.textContent = `${isVideo ? 'Video' : 'Photo'} is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(limit)}.`;
      status.classList.add('is-error');
      return;
    }

    status.classList.remove('is-error');
    status.textContent = `Uploading ${file.name || 'file'} (${formatBytes(file.size)})…`;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    galleryBtn.disabled = true;
    if (cameraBtn) cameraBtn.disabled = true;

    showLocalPreview(file, preview, previewImg, previewVideo);

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (opts.organizationId) fd.append('organizationId', String(opts.organizationId));
      const result = await uploadFile('/media/upload', fd, {
        onProgress: (pct, loaded, total) => {
          progressBar.style.width = `${Math.min(90, pct)}%`;
          status.textContent = `Uploading ${formatBytes(loaded)} / ${formatBytes(total)} (${pct}%)…`;
        },
      });

      let url = result.url;
      let shareUrl = result.shareUrl || result.url;
      const mediaType = result.mediaType || (isVideo ? 'video' : 'image');
      const publicId = result.item?.public_id || result.publicId;

      // Video: wait for server-side compression before treating as final.
      if (mediaType === 'video' && (result.compressing || result.processingStatus === 'processing') && publicId) {
        progressBar.style.width = '92%';
        status.textContent = 'Upload complete. Compressing video for faster playback…';
        const finalStatus = await pollCompression(publicId, (tick) => {
          // Indeterminate-ish progress while compressing
          const w = 92 + Math.min(7, tick);
          progressBar.style.width = `${w}%`;
          status.textContent = `Compressing video… (${tick * 2}s) Keep this tab open.`;
        });
        if (finalStatus.url) url = finalStatus.url;
        if (finalStatus.shareUrl) shareUrl = finalStatus.shareUrl;

        if (finalStatus.failed) {
          status.textContent = finalStatus.compressionError
            ? `Compression failed (${finalStatus.compressionError}). Original file is still attached.`
            : 'Compression failed. Original file is still attached.';
          status.classList.add('is-error');
        } else if (finalStatus.processingStatus === 'skipped') {
          const msg = finalStatus.compressionError || 'Kept original (already efficient).';
          status.textContent = `Video attached. ${msg}`;
        } else if (finalStatus.originalSizeBytes && finalStatus.compressedSizeBytes) {
          status.textContent = `Video compressed ${formatBytes(finalStatus.originalSizeBytes)} → ${formatBytes(finalStatus.compressedSizeBytes)} (${finalStatus.compressionRatioPercent || '?'}%). Ready.`;
        } else {
          status.textContent = 'Video compressed and ready.';
        }
      } else {
        progressBar.style.width = '100%';
        status.textContent = mediaType === 'video'
          ? 'Video attached from your device.'
          : 'Photo attached from your device.';
      }

      progressBar.style.width = '100%';
      if (typeof opts.onUploaded === 'function') {
        opts.onUploaded({
          url,
          shareUrl,
          mediaType,
          item: result.item,
          processingStatus: result.processingStatus,
        });
      }
    } catch (err) {
      status.textContent = err instanceof ApiError ? err.message : 'Could not upload from device.';
      status.classList.add('is-error');
      progressBar.style.width = '0%';
    } finally {
      galleryBtn.disabled = false;
      if (cameraBtn) cameraBtn.disabled = false;
      galleryInput.value = '';
      cameraInput.value = '';
      setTimeout(() => {
        status.classList.remove('is-error');
        progressWrap.hidden = true;
      }, 8000);
    }
  }

  galleryInput.addEventListener('change', () => handleFiles(galleryInput.files));
  cameraInput.addEventListener('change', () => handleFiles(cameraInput.files));

  wrap.appendChild(preview);
  wrap.appendChild(actions);
  wrap.appendChild(galleryInput);
  wrap.appendChild(cameraInput);
  wrap.appendChild(progressWrap);
  wrap.appendChild(status);
  wrap.appendChild(limits);
  return wrap;
}

/** Poll GET /api/media/status/:publicId until ready/failed/skipped or timeout. */
async function pollCompression(publicId, onTick) {
  const maxTicks = 150; // ~5 minutes at 2s
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    if (typeof onTick === 'function') onTick(tick);
    await sleep(2000);
    try {
      const st = await api.get(`/media/status/${encodeURIComponent(publicId)}`);
      if (st.ready || st.failed || st.processingStatus === 'skipped') {
        return st;
      }
    } catch {
      // keep polling through transient errors
    }
  }
  return {
    processingStatus: 'processing',
    ready: false,
    failed: false,
    compressionError: 'Still compressing — the watch URL will use the file once ready. You can save the story now.',
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function acceptFor(kind) {
  if (kind === 'video') return 'video/*,video/mp4,video/webm,video/quicktime';
  if (kind === 'both') return 'image/*,video/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm';
  return 'image/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
}

function isVideoFile(file) {
  if (file.type && file.type.startsWith('video/')) return true;
  return /\.(mp4|m4v|webm|mov|3gp)$/i.test(file.name || '');
}

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function showLocalPreview(file, preview, previewImg, previewVideo) {
  const objectUrl = URL.createObjectURL(file);
  preview.hidden = false;
  if (isVideoFile(file)) {
    previewImg.hidden = true;
    previewVideo.hidden = false;
    previewVideo.src = objectUrl;
  } else {
    previewVideo.hidden = true;
    previewImg.hidden = false;
    previewImg.src = objectUrl;
  }
}
