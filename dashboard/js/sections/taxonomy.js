import { api } from '../api.js';
import { el } from '../util.js';

export async function render(container, ctx) {
  const [{ items: categories }, { items: districts }] = await Promise.all([
    api.get('/categories'),
    api.get('/districts'),
  ]);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Categories & Districts', style: 'margin-bottom:16px;' }));
  wrap.appendChild(el('p', { style: 'margin-bottom:16px;color:var(--grey);font-size:13px;', text: 'These are the platform-wide categories and districts available when tagging a story. They are managed by the 256 Newsroom team.' }));

  const catCard = el('div', { class: 'dash-card' }, [el('h3', { text: `Categories (${categories.length})` })]);
  const catList = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' });
  for (const c of categories) catList.appendChild(el('span', { class: 'badge badge-grey', text: c.name }));
  catCard.appendChild(catList);
  wrap.appendChild(catCard);

  const distCard = el('div', { class: 'dash-card' }, [el('h3', { text: `Districts (${districts.length})` })]);
  const byRegion = districts.reduce((acc, d) => {
    const region = d.region || 'Other';
    (acc[region] = acc[region] || []).push(d);
    return acc;
  }, {});
  for (const [region, list] of Object.entries(byRegion)) {
    distCard.appendChild(el('p', { style: 'font-family:"Inconsolata",monospace;font-size:10.5px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--grey);margin:12px 0 6px;', text: region }));
    const row = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' });
    for (const d of list) row.appendChild(el('span', { class: 'badge badge-grey', text: d.name }));
    distCard.appendChild(row);
  }
  wrap.appendChild(distCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
