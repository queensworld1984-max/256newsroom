export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    credentials: 'same-origin',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: body || {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body || {} }),
  del: (path) => request(path, { method: 'DELETE' }),
};

/**
 * Multipart upload (do not set content-type — browser sets boundary).
 * Uses XHR so large photo/video transfers can report progress.
 * @param {string} path
 * @param {FormData} formData
 * @param {{ onProgress?: (pct:number, loaded:number, total:number) => void }} [options]
 */
export function uploadFile(path, formData, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 30 * 60 * 1000; // 30 minutes for multi‑GB mobile uploads

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof options.onProgress !== 'function') return;
      const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
      options.onProgress(pct, event.loaded, event.total);
    };

    xhr.onload = () => {
      let data = null;
      const text = xhr.responseText || '';
      if (text) {
        try { data = JSON.parse(text); } catch { data = null; }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      reject(new ApiError((data && data.error) || `Upload failed (${xhr.status})`, xhr.status));
    };

    xhr.onerror = () => reject(new ApiError('Network error while uploading. Try again on a stable connection.', 0));
    xhr.ontimeout = () => reject(new ApiError('Upload timed out. Large videos may need a stronger connection — try again.', 0));
    xhr.send(formData);
  });
}
