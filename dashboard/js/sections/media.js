import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const { items } = await api.get(`/publishers/${ctx.orgId}/media`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Media Library', style: 'margin-bottom:16px;' }));

  const formCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Add an image' })]);
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Image URL <input name="url" type="url" required placeholder="https://"></label>
    <label>Caption <input name="caption"></label>
    <label>Credit <input name="credit"></label>
    <label class="full">Alt text <input name="altText"></label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const btn = el('button', { type: 'submit', text: 'Add to library' });
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

  const gridCard = el('div', { class: 'dash-card' });
  if (!items.length) {
    gridCard.appendChild(el('p', { class: 'dash-empty', text: 'No images added yet. Paste an external image URL above to reuse it across stories.' }));
  } else {
    const grid = el('div', { class: 'dash-media-grid' });
    for (const m of items) {
      const item = el('div', { class: 'dash-media-item' });
      const img = el('img', { src: m.url, alt: m.alt_text || '' });
      img.addEventListener('error', () => { img.style.display = 'none'; });
      item.appendChild(img);
      item.appendChild(el('div', { class: 'cap', text: m.caption || m.url }));
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
      grid.appendChild(item);
    }
    gridCard.appendChild(grid);
  }
  wrap.appendChild(gridCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
