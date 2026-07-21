import { api } from '../api.js';
import { el, formatDate, statusBadgeClass } from '../util.js';
import { storiesBasePath, storyPath } from '../storiesApi.js';

const STATUSES = [
  ['', 'All'],
  ['draft', 'Draft'],
  ['pending_review', 'Pending review'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['withdrawn', 'Withdrawn'],
];

export async function render(container, ctx, opts) {
  const activeStatus = opts.status || '';
  const basePath = storiesBasePath(ctx);
  const query = activeStatus && ctx.mode === 'org' ? `?status=${activeStatus}` : '';
  const { items: allItems } = await api.get(`${basePath}${query}`);
  const items = ctx.mode === 'independent' && activeStatus ? allItems.filter((s) => s.status === activeStatus) : allItems;

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: ctx.mode === 'org' ? 'Stories' : 'My Stories' }),
    (() => { const a = el('a', { href: '#/stories/new' }); const b = el('button', { text: '+ New Story' }); a.appendChild(b); return a; })(),
  ]));

  const tabs = el('div', { class: 'dash-actions', style: 'margin-bottom:14px;' });
  for (const [key, label] of STATUSES) {
    const a = el('a', { href: key ? `#/stories?status=${key}` : '#/stories' });
    const btn = el('button', { class: key === activeStatus ? 'small' : 'small secondary', text: label });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', key ? `#/stories?status=${key}` : '#/stories');
      render(container, ctx, { status: key || undefined });
    });
    a.appendChild(btn);
    tabs.appendChild(a);
  }
  wrap.appendChild(tabs);

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No stories in this view.' })]));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Title</th><th>Status</th><th>Updated</th><th></th></tr></thead>';
    const tbody = el('tbody');
    for (const s of items) {
      const tr = el('tr');
      const titleTd = el('td');
      titleTd.appendChild(el('a', { href: `#/stories/${s.id}/edit`, text: s.title || '(untitled)' }));
      if (s.breaking) titleTd.appendChild(el('span', { class: 'badge badge-red', style: 'margin-left:6px;', text: 'Breaking' }));
      if (s.developing) titleTd.appendChild(el('span', { class: 'badge badge-gold', style: 'margin-left:6px;', text: 'Developing' }));
      tr.appendChild(titleTd);
      tr.appendChild(el('td', {}, [el('span', { class: `badge ${statusBadgeClass(s.status)}`, text: s.status.replace(/_/g, ' ') })]));
      tr.appendChild(el('td', { text: formatDate(s.updated_at) }));
      const actionsTd = el('td');
      actionsTd.appendChild(el('a', { href: `#/stories/${s.id}/edit`, text: 'Open →' }));
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(el('div', { class: 'dash-card' }, [table]));
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}
