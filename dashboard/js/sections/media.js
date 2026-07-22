import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';
import { buildDeviceAttach } from '../deviceUpload.js';

export async function render(container, ctx) {
  const query = ctx.mode === 'org' && ctx.orgId
    ? `?organizationId=${encodeURIComponent(ctx.orgId)}`
    : '';
  let items = [];
  try {
    const res = await api.get(`/media/mine${query}`);
    items = res.items || [];
  } catch {
    // Fall back to legacy org URL-only library if shared media API is unavailable
    if (ctx.mode === 'org' && ctx.orgId) {
      try {
        const res = await api.get(`/publishers/${ctx.orgId}/media`);
        items = res.items || [];
      } catch { items = []; }
    }
  }

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Media Library', style: 'margin-bottom:8px;' }));
  wrap.appendChild(el('p', {
    style: 'margin-bottom:16px;color:var(--grey);font-size:13px;',
    text: 'Attach photos and videos directly from your phone or computer. Videos get a public watch page URL you can share (like YouTube).',
  }));

  const uploadCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Attach from device' })]);
  uploadCard.appendChild(buildDeviceAttach({
    kind: 'both',
    organizationId: ctx.mode === 'org' && ctx.orgId ? ctx.orgId : null,
    label: 'Choose photo or video from device',
    onUploaded: () => render(container, ctx),
  }));
  wrap.appendChild(uploadCard);

  if (ctx.mode === 'org' && ctx.orgId) {
    const formCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Add external image URL' })]);
    const form = el('form', { class: 'dash-form' });
    form.innerHTML = `
      <label class="full">Image URL <input name="url" type="url" required placeholder="https://"></label>
      <label>Caption <input name="caption"></label>
      <label>Credit <input name="credit"></label>
      <label class="full">Alt text <input name="altText"></label>
    `;
    const actions = el('div', { class: 'dash-actions full' });
    const btn = el('button', { type: 'submit', class: 'secondary', text: 'Add URL to library' });
    actions.appendChild(btn);
    form.appendChild(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      try {
        await api.post(`/publishers/${ctx.orgId}/media`, raw);
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
    formCard.appendChild(form);
    wrap.appendChild(formCard);
  }

  const gridCard = el('div', { class: 'dash-card' });
  if (!items.length) {
    gridCard.appendChild(el('p', { class: 'dash-empty', text: 'No media yet. Upload an image or video above.' }));
  } else {
    const grid = el('div', { class: 'dash-media-grid' });
    for (const m of items) {
      const item = el('div', { class: 'dash-media-item' });
      if (m.media_type === 'video') {
        item.appendChild(el('div', {
          class: 'cap',
          style: 'aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;font-weight:700;',
          text: 'VIDEO',
        }));
      } else {
        const img = el('img', { src: m.url || m.fileUrl, alt: m.alt_text || '' });
        img.addEventListener('error', () => { img.style.display = 'none'; });
        item.appendChild(img);
      }
      item.appendChild(el('div', { class: 'cap', text: m.caption || m.original_filename || m.url }));
      if (m.shareUrl || m.public_id) {
        const share = m.shareUrl || (m.media_type === 'video'
          ? `/media/watch/${m.public_id}`
          : m.url);
        const link = el('a', {
          href: share,
          target: '_blank',
          rel: 'noopener',
          text: m.media_type === 'video' ? 'Open watch URL' : 'Open file',
          style: 'display:block;padding:4px 8px;font-size:11px;',
        });
        item.appendChild(link);
        const copyBtn = el('button', {
          class: 'small secondary',
          text: 'Copy URL',
          style: 'margin:0 8px 8px;',
        });
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(share.startsWith('http') ? share : `${location.origin}${share}`);
            copyBtn.textContent = 'Copied';
            setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 1200);
          } catch {
            prompt('Copy this URL:', share);
          }
        });
        item.appendChild(copyBtn);
      }
      if (ctx.mode === 'org' && ctx.orgId && m.id) {
        const delBtn = el('button', { class: 'small danger', text: 'Remove', style: 'margin:0 8px 8px;' });
        delBtn.addEventListener('click', async () => {
          try {
            await api.del(`/publishers/${ctx.orgId}/media/${m.id}`);
            render(container, ctx);
          } catch (err) {
            alert(err instanceof ApiError ? err.message : 'Something went wrong.');
          }
        });
        item.appendChild(delBtn);
      }
      grid.appendChild(item);
    }
    gridCard.appendChild(grid);
  }
  wrap.appendChild(gridCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
