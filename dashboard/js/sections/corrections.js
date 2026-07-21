import { api } from '../api.js';
import { el, formatDate } from '../util.js';

export async function render(container, ctx) {
  const { items } = await api.get(`/publishers/${ctx.orgId}/corrections`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Corrections', style: 'margin-bottom:16px;' }));

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No corrections have been published yet.' })]));
  } else {
    for (const c of items) {
      const card = el('div', { class: 'dash-card' });
      card.appendChild(el('div', { class: 'dash-section-title' }, [
        el('a', { href: `#/stories/${c.article_id}/edit`, text: c.current_title }),
        el('span', { style: 'color:var(--grey);font-size:12px;', text: formatDate(c.corrected_at) }),
      ]));
      if (c.correction_note) card.appendChild(el('p', { style: 'margin-bottom:8px;', text: c.correction_note }));
      if (c.previous_headline && c.previous_headline !== c.current_title) {
        card.appendChild(el('p', { style: 'color:var(--grey);font-size:12.5px;', text: `Previous headline: ${c.previous_headline}` }));
      }
      wrap.appendChild(card);
    }
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}
