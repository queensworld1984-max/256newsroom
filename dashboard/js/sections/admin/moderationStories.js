import { api, ApiError } from '../../api.js';
import { el, formatDate } from '../../util.js';

export async function render(container, _ctx, query = {}) {
  const status = query.status || '';
  const path = status ? `/admin/people/stories?status=${encodeURIComponent(status)}` : '/admin/people/stories';
  const { items } = await api.get(path);

  const wrap = el('div', { class: 'admin-command' });
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: 'Author story queue' }),
  ]));
  wrap.appendChild(el('p', {
    style: 'margin:0 0 12px;color:var(--grey);font-size:13px;',
    text: 'All publisher-authored drafts and pending reviews across the platform. Force-publish puts a story live immediately (independent byline if the org is still unverified).',
  }));

  const filters = el('div', { class: 'dash-actions', style: 'margin-bottom:16px;' });
  for (const [val, label] of [['', 'All authored'], ['draft', 'Drafts'], ['pending_review', 'Pending review'], ['published', 'Published'], ['scheduled', 'Scheduled']]) {
    const a = el('a', {
      class: `admin-pill${status === val ? '' : ' secondary'}`,
      href: val ? `#/admin/stories?status=${val}` : '#/admin/stories',
      text: label,
    });
    filters.appendChild(a);
  }
  wrap.appendChild(filters);

  const card = el('div', { class: 'dash-card' });
  if (!items.length) {
    card.appendChild(el('p', { class: 'dash-empty', text: 'No stories in this filter.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = `<thead><tr>
      <th>ID</th><th>Title</th><th>Author</th><th>Org / byline</th><th>Status</th><th>Updated</th><th>Actions</th>
    </tr></thead>`;
    const tbody = el('tbody');
    for (const s of items) {
      const act = el('td');
      if (s.status !== 'published') {
        const btn = el('button', { class: 'small', text: 'Publish live' });
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await api.post(`/admin/people/stories/${s.id}/publish`, {});
            render(container, _ctx, query);
          } catch (err) {
            btn.disabled = false;
            alert(err instanceof ApiError ? err.message : 'Failed.');
          }
        });
        act.appendChild(btn);
      } else {
        act.appendChild(el('span', { class: 'badge badge-green', text: 'Live' }));
      }
      tbody.appendChild(el('tr', {}, [
        el('td', { text: String(s.id) }),
        el('td', { text: s.title || '(untitled)' }),
        el('td', { text: s.author_name || s.author_email || '—' }),
        el('td', { text: s.org_name ? `${s.org_name}` : (s.journalist_name || 'Independent') }),
        el('td', {}, [el('span', { class: `badge ${s.status === 'published' ? 'badge-green' : 'badge-gold'}`, text: String(s.status).replace(/_/g, ' ') })]),
        el('td', { text: formatDate(s.updated_at) }),
        act,
      ]));
    }
    table.appendChild(tbody);
    card.appendChild(table);
  }
  wrap.appendChild(card);
  container.innerHTML = '';
  container.appendChild(wrap);
}
