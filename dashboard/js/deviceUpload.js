import { ApiError, api, uploadFile } from './api.js';
import { el } from './util.js';

// Keep in sync with backend defaults (MEDIA_MAX_*_MB).
const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_VIDEO_BYTES = 2048 * 1024 * 1024; // 2 GB
const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Device-first media picker: opens the phone/computer file picker (gallery)
 * or camera, uploads immediately (including large files), returns public URLs.
 * Videos and audio are compressed server-side after upload; this UI polls until ready.
 *
 * @param {object} opts
 * @param {'image'|'video'|'audio'|'both'|'media'} opts.kind
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
  const previewAudio = el('audio', { controls: true, preload: 'metadata' });
  preview.appendChild(previewImg);
  preview.appendChild(previewVideo);
  preview.appendChild(previewAudio);
  previewImg.hidden = true;
  previewVideo.hidden = true;
  previewAudio.hidden = true;

  const progressWrap = el('div', { class: 'device-upload-progress', hidden: true });
  const progressBar = el('div', { class: 'device-upload-progress-bar' });
  progressWrap.appendChild(progressBar);

  const status = el('p', { class: 'device-attach-status' });
  const limits = el('p', {
    class: 'device-attach-limits',
    text: limitsText(kind),
  });

  const galleryInput = el('input', {
    type: 'file',
    class: 'device-file-input',
    accept: acceptFor(kind),
  });
  galleryInput.setAttribute('aria-label', 'Choose from device');

  const showCamera = kind === 'image' || kind === 'both' || kind === 'media';
  const cameraInput = showCamera
    ? el('input', {
      type: 'file',
      class: 'device-file-input',
      accept: kind === 'video' ? 'video/*' : 'image/*',
    })
    : null;
  if (cameraInput) {
    cameraInput.setAttribute('capture', 'environment');
    cameraInput.setAttribute('aria-label', 'Take with camera');
  }

  const actions = el('div', { class: 'device-attach-actions' });
  const galleryBtn = el('button', {
    type: 'button',
    class: 'device-pick-btn',
    text: opts.label || defaultLabel(kind),
  });
  const cameraBtn = showCamera && kind !== 'video' && kind !== 'audio'
    ? el('button', { type: 'button', class: 'secondary device-camera-btn', text: 'Take photo' })
    : null;

  actions.appendChild(galleryBtn);
  if (cameraBtn) actions.appendChild(cameraBtn);

  galleryBtn.addEventListener('click', () => galleryInput.click());
  if (cameraBtn && cameraInput) cameraBtn.addEventListener('click', () => cameraInput.click());

  async function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;

    const isVideo = isVideoFile(file);
    const isAudio = isAudioFile(file);
    const limit = isVideo ? MAX_VIDEO_BYTES : isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    const kindLabel = isVideo ? 'Video' : isAudio ? 'Audio' : 'Photo';
    if (file.size > limit) {
      status.textContent = `${kindLabel} is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(limit)}.`;
      status.classList.add('is-error');
      return;
    }

    status.classList.remove('is-error');
    status.textContent = `Uploading ${file.name || 'file'} (${formatBytes(file.size)})…`;
    progressWrap.hidden = false;
    progressBar.style.width = '0%';
    galleryBtn.disabled = true;
    if (cameraBtn) cameraBtn.disabled = true;

    showLocalPreview(file, preview, previewImg, previewVideo, previewAudio);

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
      const mediaType = result.mediaType || (isVideo ? 'video' : isAudio ? 'audio' : 'image');
      const publicId = result.item?.public_id || result.publicId;

      // Video/audio: wait for server-side compression before treating as final.
      if ((mediaType === 'video' || mediaType === 'audio')
        && (result.compressing || result.processingStatus === 'processing')
        && publicId) {
        progressBar.style.width = '92%';
        status.textContent = `Upload complete. Compressing ${mediaType} for faster playback…`;
        const finalStatus = await pollCompression(publicId, (tick) => {
          const w = 92 + Math.min(7, tick);
          progressBar.style.width = `${w}%`;
          status.textContent = `Compressing ${mediaType}… (${tick * 2}s) Keep this tab open.`;
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
          status.textContent = `${kindLabel} attached. ${msg}`;
        } else if (finalStatus.originalSizeBytes && finalStatus.compressedSizeBytes) {
          status.textContent = `${kindLabel} compressed ${formatBytes(finalStatus.originalSizeBytes)} → ${formatBytes(finalStatus.compressedSizeBytes)} (${finalStatus.compressionRatioPercent || '?'}%). Ready.`;
        } else {
          status.textContent = `${kindLabel} compressed and ready.`;
        }
      } else {
        progressBar.style.width = '100%';
        status.textContent = mediaType === 'video'
          ? 'Video attached from your device.'
          : mediaType === 'audio'
            ? 'Audio attached from your device.'
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
      if (cameraInput) cameraInput.value = '';
      setTimeout(() => {
        status.classList.remove('is-error');
        progressWrap.hidden = true;
      }, 8000);
    }
  }

  galleryInput.addEventListener('change', () => handleFiles(galleryInput.files));
  if (cameraInput) cameraInput.addEventListener('change', () => handleFiles(cameraInput.files));

  wrap.appendChild(preview);
  wrap.appendChild(actions);
  wrap.appendChild(galleryInput);
  if (cameraInput) wrap.appendChild(cameraInput);
  wrap.appendChild(progressWrap);
  wrap.appendChild(status);
  wrap.appendChild(limits);
  return wrap;
}

/**
 * Build UI to create a sound bite from the last uploaded audio (or video).
 * Calls POST /media/soundbite and returns the clip URL via onCreated.
 *
 * @param {object} opts
 * @param {() => string|null} opts.getSourcePublicId
 * @param {number|null} [opts.organizationId]
 * @param {(result: object) => void} opts.onCreated
 */
export function buildSoundbiteCreator(opts) {
  const wrap = el('div', { class: 'soundbite-creator' });
  const status = el('p', { class: 'device-attach-status' });

  const startInput = el('input', {
    type: 'number',
    min: '0',
    step: '1',
    value: '0',
    class: 'soundbite-start',
  });
  startInput.setAttribute('aria-label', 'Start seconds');

  const durationInput = el('input', {
    type: 'number',
    min: '5',
    max: '90',
    step: '1',
    value: '30',
    class: 'soundbite-duration',
  });
  durationInput.setAttribute('aria-label', 'Duration seconds');

  const row = el('div', { class: 'soundbite-fields' });
  row.appendChild(el('label', {}, [
    document.createTextNode('Start (sec) '),
    startInput,
  ]));
  row.appendChild(el('label', {}, [
    document.createTextNode('Length (sec, 5–90) '),
    durationInput,
  ]));

  const btn = el('button', {
    type: 'button',
    class: 'secondary soundbite-create-btn',
    text: 'Create sound bite from attached audio/video',
  });

  btn.addEventListener('click', async () => {
    const publicId = typeof opts.getSourcePublicId === 'function' ? opts.getSourcePublicId() : null;
    if (!publicId) {
      status.textContent = 'Upload full audio (or video) first, then create a sound bite from it.';
      status.classList.add('is-error');
      return;
    }
    btn.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Creating sound bite…';
    try {
      const body = {
        publicId,
        startSeconds: Number(startInput.value) || 0,
        durationSeconds: Number(durationInput.value) || 30,
      };
      if (opts.organizationId) body.organizationId = opts.organizationId;
      const result = await api.post('/media/soundbite', body);
      status.textContent = result.message || 'Sound bite ready.';
      if (typeof opts.onCreated === 'function') {
        opts.onCreated({
          url: result.url,
          shareUrl: result.shareUrl || result.url,
          mediaType: 'soundbite',
          item: result.item,
          durationSeconds: result.durationSeconds,
        });
      }
    } catch (err) {
      status.textContent = err instanceof ApiError ? err.message : 'Could not create sound bite.';
      status.classList.add('is-error');
    } finally {
      btn.disabled = false;
    }
  });

  wrap.appendChild(row);
  wrap.appendChild(btn);
  wrap.appendChild(status);
  wrap.appendChild(el('p', {
    class: 'device-attach-limits',
    text: 'Clips the source file with ffmpeg (default 30s, max 90s). Attach the result to the story and save.',
  }));
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
    compressionError: 'Still compressing — the listen/watch URL will use the file once ready. You can save the story now.',
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultLabel(kind) {
  if (kind === 'video') return 'Attach video from device';
  if (kind === 'audio') return 'Attach audio from device';
  if (kind === 'media' || kind === 'both') return 'Attach media from device';
  return 'Attach photo from device';
}

function limitsText(kind) {
  if (kind === 'video') {
    return `Videos up to ${formatBytes(MAX_VIDEO_BYTES)}. Server compresses after upload for faster playback.`;
  }
  if (kind === 'audio') {
    return `Audio up to ${formatBytes(MAX_AUDIO_BYTES)} (MP3, M4A, WAV, OGG, AAC, FLAC). Server compresses to MP3.`;
  }
  if (kind === 'both' || kind === 'media') {
    return `Photos up to ${formatBytes(MAX_IMAGE_BYTES)}, audio up to ${formatBytes(MAX_AUDIO_BYTES)}, videos up to ${formatBytes(MAX_VIDEO_BYTES)}. Audio/video are auto-compressed on the server.`;
  }
  return `Photos up to ${formatBytes(MAX_IMAGE_BYTES)}.`;
}

function acceptFor(kind) {
  if (kind === 'video') return 'video/*,video/mp4,video/webm,video/quicktime';
  if (kind === 'audio') return 'audio/*,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/aac,audio/flac,.mp3,.m4a,.wav,.ogg,.aac,.flac';
  if (kind === 'both') return 'image/*,video/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm';
  if (kind === 'media') {
    return 'image/*,video/*,audio/*,image/jpeg,image/png,image/webp,image/gif,image/heic,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/mp4,.mp3,.m4a,.wav';
  }
  return 'image/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
}

function isVideoFile(file) {
  if (file.type && file.type.startsWith('video/')) return true;
  return /\.(mp4|m4v|webm|mov|3gp)$/i.test(file.name || '');
}

function isAudioFile(file) {
  if (file.type && file.type.startsWith('audio/')) return true;
  return /\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i.test(file.name || '')
    && !isVideoFile(file);
}

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function showLocalPreview(file, preview, previewImg, previewVideo, previewAudio) {
  const objectUrl = URL.createObjectURL(file);
  preview.hidden = false;
  if (isVideoFile(file)) {
    previewImg.hidden = true;
    previewAudio.hidden = true;
    previewVideo.hidden = false;
    previewVideo.src = objectUrl;
  } else if (isAudioFile(file)) {
    previewImg.hidden = true;
    previewVideo.hidden = true;
    previewAudio.hidden = false;
    previewAudio.src = objectUrl;
  } else {
    previewVideo.hidden = true;
    previewAudio.hidden = true;
    previewImg.hidden = false;
    previewImg.src = objectUrl;
  }
}
