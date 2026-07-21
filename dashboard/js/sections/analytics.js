import { api } from '../api.js';
import { el } from '../util.js';

function barRow(label, count, max) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const row = el('div', { style: 'margin-bottom:10px;' });
  row.appendChild(el('div', { style: 'display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px;' }, [
    el('span', { text: label }), el('b', { text: String(count) }),
  ]));
  row.appendChild(el('div', { style: 'background:var(--paper-dim);height:8px;' }, [
    el('div', { style: `background:var(--gold-bright);height:100%;width:${pct}%;` }),
  ]));
  return row;
}

export async function render(container, ctx) {
  const data = await api.get(`/publishers/${ctx.orgId}/analytics`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Analytics', style: 'margin-bottom:16px;' }));
  wrap.appendChild(el('p', { style: 'margin-bottom:16px;color:var(--grey);font-size:13px;', text: 'Counts are drawn directly from your organization’s own stories — there is no reader engagement tracking yet.' }));

  const stats = el('div', { class: 'dash-stat-row' });
  const t = data.totals;
  stats.appendChild(el('div', { class: 'dash-stat' }, [el('b', { text: String(t.published_count) }), el('span', { text: 'Published' })]));
  stats.appendChild(el('div', { class: 'dash-stat' }, [el('b', { text: String(t.breaking_count) }), el('span', { text: 'Breaking' })]));
  stats.appendChild(el('div', { class: 'dash-stat' }, [el('b', { text: String(t.developing_count) }), el('span', { text: 'Developing' })]));
  wrap.appendChild(stats);

  const statusCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Stories by status' })]);
  const maxStatus = Math.max(1, ...data.byStatus.map((r) => r.count));
  if (!data.byStatus.length) statusCard.appendChild(el('p', { class: 'dash-empty', text: 'No stories yet.' }));
  for (const r of data.byStatus) statusCard.appendChild(barRow(r.status.replace(/_/g, ' '), r.count, maxStatus));
  wrap.appendChild(statusCard);

  const catCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Stories by category' })]);
  const maxCat = Math.max(1, ...data.byCategory.map((r) => r.count));
  if (!data.byCategory.length) catCard.appendChild(el('p', { class: 'dash-empty', text: 'No categorized stories yet.' }));
  for (const r of data.byCategory) catCard.appendChild(barRow(r.name, r.count, maxCat));
  wrap.appendChild(catCard);

  const trendCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Published in the last 30 days' })]);
  if (!data.publishTrend.length) {
    trendCard.appendChild(el('p', { class: 'dash-empty', text: 'Nothing published in the last 30 days.' }));
  } else {
    const maxTrend = Math.max(1, ...data.publishTrend.map((r) => r.count));
    for (const r of data.publishTrend) trendCard.appendChild(barRow(new Date(r.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), r.count, maxTrend));
  }
  wrap.appendChild(trendCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
