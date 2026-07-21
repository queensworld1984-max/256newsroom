import { api } from '../../api.js';
import { el } from '../../util.js';

export async function render(container, ctx) {
  const { items: platforms } = await api.get('/admin/ecosystem/platforms');

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Platforms', style: 'margin-bottom:16px;' }));

  const table = el('table', { class: 'dash-table' });
  table.innerHTML = '<thead><tr><th>Platform</th><th>Website</th><th>Mode</th><th>Target / Max</th><th>Active days</th></tr></thead>';
  const tbody = el('tbody');
  for (const p of platforms) {
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [el('a', { href: `#/admin/ecosystem/platforms/${p.id}`, text: p.name })]),
      el('td', {}, [el('a', { href: p.website_url, target: '_blank', rel: 'noopener', text: p.website_url })]),
      el('td', {}, [el('span', { class: `badge ${p.mode === 'automatic' ? 'badge-green' : p.mode === 'paused' ? 'badge-red' : 'badge-gold'}`, text: p.mode })]),
      el('td', { text: `${p.daily_target} / ${p.daily_max}` }),
      el('td', { text: (p.active_days || []).join(', ') }),
    ]));
  }
  table.appendChild(tbody);
  wrap.appendChild(el('div', { class: 'dash-card' }, [table]));

  container.innerHTML = '';
  container.appendChild(wrap);
}
