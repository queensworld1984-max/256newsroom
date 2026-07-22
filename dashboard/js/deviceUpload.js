import { ApiError, uploadFile } from './api.js';
import { el } from './util.js';

// Keep in sync with backend defaults (MEDIA_MAX_IMAGE_MB / MEDIA_MAX_VIDEO_MB).
const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_VIDEO_BYTES = 2048 * 1024 * 1024; // 2 GB

/**
 * Device-first media picker: opens the phone/computer file picker (gallery)
 * or camera, uploads immediately (including large files), returns public URLs.
 *
 * @param {object} opts
 * @param {'image'|'video'|'both'} opts.kind
 * @param {number|null} [opts.organizationId]
 * @param {(result: {url:string, shareUrl:string, mediaType:string}) => void} opts.onUploaded
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
      ? `Large videos supported — up to ${formatBytes(MAX_VIDEO_BYTES)}.`
      : kind === 'both'
        ? `Large files supported — photos up to ${formatBytes(MAX_IMAGE_BYTES)}, videos up to ${formatBytes(MAX_VIDEO_BYTES)}.`
        : `Large photos supported — up to ${formatBytes(MAX_IMAGE_BYTES)}.`,
  });

  const galleryInput = el('input', {
    type: 'file',
    class: 'device-file-input',
    accept: acceptFor(kind),
  });
  galleryInput.setAttribute('aria-label', 'Choose from device');

  // Mobile camera (ignored on desktop; still opens a picker).
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
    status.textContent = `Uploading ${file.name || 'file'} (${formatBytes(file.size)})… Large files may take a few minutes.`;
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
          progressBar.style.width = `${pct}%`;
          status.textContent = `Uploading ${formatBytes(loaded)} / ${formatBytes(total)} (${pct}%)…`;
        },
      });
      progressBar.style.width = '100%';
      const url = result.url;
      const shareUrl = result.shareUrl || result.url;
      const mediaType = result.mediaType || (isVideo ? 'video' : 'image');
      status.textContent = mediaType === 'video'
        ? 'Video attached from your device. Watch URL is ready.'
        : 'Photo attached from your device.';
      if (typeof opts.onUploaded === 'function') {
        opts.onUploaded({ url, shareUrl, mediaType, item: result.item });
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
      }, 5000);
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

function acceptFor(kind) {
  if (kind === 'video') return 'video/*,video/mp4,video/webm,video/quicktime';
  if (kind === 'both') return 'image/*,video/*,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm';
  // image/* lets phones open the full gallery (including HEIC on iOS).
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
