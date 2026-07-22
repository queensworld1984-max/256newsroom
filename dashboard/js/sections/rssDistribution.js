import { el } from '../util.js';

export async function render(container, ctx) {
  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'RSS Distribution', style: 'margin-bottom:16px;' }));

  const url = `https://256newsroom.com/rss/publishers/${ctx.organization.slug}.xml`;
  const card = el('div', { class: 'dash-card' }, [
    el('h3', { text: 'Your publisher feed' }),
    el('p', { style: 'margin:10px 0;color:var(--grey);font-size:13px;', text: 'This feed publishes automatically once outbound RSS generation launches. It will always exclude drafts, scheduled, withdrawn and unapproved content.' }),
  ]);
  const codeBox = el('div', { style: 'background:var(--paper-dim);font-family:"Inconsolata",monospace;font-size:12.5px;padding:10px 12px;word-break:break-all;' }, [url]);
  card.appendChild(codeBox);
  wrap.appendChild(card);

  container.innerHTML = '';
  container.appendChild(wrap);
}
