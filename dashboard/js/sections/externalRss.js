import { api, ApiError } from '../api.js';
import { el, escapeHtml, formatDate } from '../util.js';

export async function render(container, ctx) {
  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'External RSS', style: 'margin-bottom:16px;' }));

  let feeds = null;
  try {
    const res = await api.get(`/publishers/${ctx.orgId}/feeds`);
    feeds = res.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) feeds = null;
    else throw err;
  }

  if (feeds === null) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [
      el('p', { class: 'dash-empty', text: 'External feed connections are not available yet — this launches next, in the RSS auto-import release.' }),
    ]));
    container.innerHTML = '';
    container.appendChild(wrap);
    return;
  }

  const formCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Connect a feed' })]);
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Feed URL <input name="feedUrl" type="url" required placeholder="https://yoursite.com/feed.xml"></label>
    <label>Publish mode
      <select name="publishMode">
        <option value="draft">Import as draft</option>
        <option value="auto_publish">Auto-publish (approved publishers only)</option>
      </select>
    </label>
    <label>Content mode
      <select name="contentMode">
        <option value="headline_only">Headline & link only</option>
        <option value="headline_summary_image">Summary & image</option>
      </select>
    </label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const btn = el('button', { type: 'submit', text: 'Connect feed' });
  actions.appendChild(btn);
  form.appendChild(actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post(`/publishers/${ctx.orgId}/feeds`, raw);
      render(container, ctx);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  formCard.appendChild(form);
  wrap.appendChild(formCard);

  const listCard = el('div', { class: 'dash-card' });
  if (!feeds.length) {
    listCard.appendChild(el('p', { class: 'dash-empty', text: 'No feeds connected yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Feed</th><th>Status</th><th>Last polled</th><th></th></tr></thead>';
    const tbody = el('tbody');
    for (const f of feeds) {
      const tr = el('tr');
      tr.appendChild(el('td', { text: f.feed_url }));
      tr.appendChild(el('td', {}, [el('span', { class: `badge ${f.active ? 'badge-green' : 'badge-grey'}`, text: f.active ? 'Active' : 'Paused' })]));
      tr.appendChild(el('td', { text: formatDate(f.last_polled_at) }));
      const actionsTd = el('td');
      const toggleBtn = el('button', { class: 'small secondary', text: f.active ? 'Pause' : 'Resume' });
      toggleBtn.addEventListener('click', async () => {
        try {
          await api.patch(`/publishers/${ctx.orgId}/feeds/${f.id}`, { active: !f.active });
          render(container, ctx);
        } catch (err) {
          alert(err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actionsTd.appendChild(toggleBtn);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    listCard.appendChild(table);
  }
  wrap.appendChild(listCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
