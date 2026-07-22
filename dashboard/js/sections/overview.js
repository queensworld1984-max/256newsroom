import { api } from '../api.js';
import { el, formatDate } from '../util.js';
import { storiesBasePath } from '../storiesApi.js';

export async function render(container, ctx) {
  const { items } = await api.get(storiesBasePath(ctx));
  const counts = items.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const wrap = el('div');

  if (ctx.mode === 'org') {
    const org = ctx.organization;
    const statusLabel = org.is_official ? 'Official 256 Update' : org.verification_status.replace(/_/g, ' ');
    wrap.appendChild(el('div', { class: 'dash-card' }, [
      el('h2', { text: org.name }),
      el('p', {}, [el('span', { class: `badge ${org.verification_status === 'approved' ? 'badge-green' : 'badge-gold'}`, text: statusLabel })]),
      org.verification_status !== 'approved'
        ? el('p', { style: 'margin-top:10px;color:var(--grey);font-size:13px;', text: 'Stories can be drafted now, but publishing is disabled until an admin approves this organization. See Verification for status.' })
        : null,
    ].filter(Boolean)));
  }

  const statRow = el('div', { class: 'dash-stat-row' });
  const labels = [['draft', 'Drafts'], ['pending_review', 'Pending review'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['withdrawn', 'Withdrawn']];
  for (const [key, label] of labels) {
    statRow.appendChild(el('div', { class: 'dash-stat' }, [
      el('b', { text: String(counts[key] || 0) }),
      el('span', { text: label }),
    ]));
  }
  wrap.appendChild(statRow);

  const recent = [...items].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5);
  const recentCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Recently updated stories' })]);
  if (!recent.length) {
    recentCard.appendChild(el('p', { class: 'dash-empty', text: 'No stories yet. Create your first story to get started.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Title</th><th>Status</th><th>Updated</th></tr></thead>';
    const tbody = el('tbody');
    for (const s of recent) {
      const tr = el('tr');
      const titleTd = el('td');
      const link = el('a', { href: `#/stories/${s.id}/edit`, text: s.title || '(untitled)' });
      titleTd.appendChild(link);
      tr.appendChild(titleTd);
      tr.appendChild(el('td', { text: s.status.replace(/_/g, ' ') }));
      tr.appendChild(el('td', { text: formatDate(s.updated_at) }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    recentCard.appendChild(table);
  }
  wrap.appendChild(recentCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
