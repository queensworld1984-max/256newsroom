import { api, ApiError } from '../api.js';
import { el, escapeHtml, formatDate } from '../util.js';

export async function render(container, ctx) {
  if (ctx.mode !== 'org' || !ctx.orgId) {
    container.innerHTML = '<p class="dash-empty">Subscribers are available for publisher organizations.</p>';
    return;
  }

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Subscribers & updates', style: 'margin-bottom:8px;' }));
  wrap.appendChild(el('p', {
    style: 'color:var(--grey);font-size:13.5px;margin:0 0 18px;max-width:62ch;',
    text: 'People who subscribe to your news updates appear here. Send them articles, press releases, or general updates. Registered members receive them in their inbox.',
  }));

  let subs = { items: [], activeCount: 0 };
  let broadcasts = { items: [] };
  let stories = { items: [] };
  try {
    [subs, broadcasts, stories] = await Promise.all([
      api.get(`/publishers/${ctx.orgId}/subscribers`),
      api.get(`/publishers/${ctx.orgId}/broadcasts`),
      api.get(`/publishers/${ctx.orgId}/stories`).catch(() => ({ items: [] })),
    ]);
  } catch (err) {
    wrap.appendChild(el('p', {
      style: 'color:var(--red);',
      text: err instanceof ApiError ? err.message : 'Could not load subscribers.',
    }));
    container.innerHTML = '';
    container.appendChild(wrap);
    return;
  }

  // Stats
  const stats = el('div', {
    style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;',
  });
  [
    ['Active subscribers', subs.activeCount || 0],
    ['All records', subs.totalCount || (subs.items || []).length],
    ['Updates sent', (broadcasts.items || []).length],
  ].forEach(([label, value]) => {
    const card = el('div', { class: 'dash-card', style: 'padding:14px;' });
    card.innerHTML = `<div style="font-family:Inconsolata,monospace;font-size:11px;text-transform:uppercase;color:var(--grey);">${escapeHtml(label)}</div>
      <div style="font-family:'DM Serif Display',Georgia,serif;font-size:28px;margin-top:4px;">${value}</div>`;
    stats.appendChild(card);
  });
  wrap.appendChild(stats);

  // Compose broadcast
  const compose = el('div', { class: 'dash-card' });
  compose.appendChild(el('h3', { text: 'Send update to subscribers' }));
  const form = el('form', { class: 'dash-form' });
  const storyOptions = (stories.items || [])
    .filter((s) => s.status === 'published')
    .map((s) => `<option value="${s.id}">${escapeHtml(s.title || `Story #${s.id}`)}</option>`)
    .join('');
  form.innerHTML = `
    <label>Type
      <select name="kind">
        <option value="update">General update</option>
        <option value="article">Article</option>
        <option value="press_release">Press release</option>
        <option value="newsletter">Newsletter</option>
      </select>
    </label>
    <label class="full">Subject <input name="subject" required maxlength="300" placeholder="Headline of your update"></label>
    <label class="full">Message <textarea name="body" rows="6" required maxlength="20000" placeholder="Write the update, press release, or note for subscribers…"></textarea></label>
    <label class="full">Attach published story (optional)
      <select name="articleId">
        <option value="">— None —</option>
        ${storyOptions}
      </select>
    </label>
    <label class="full">Link URL (optional) <input name="linkUrl" type="url" maxlength="1000" placeholder="https://…"></label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const sendBtn = el('button', { type: 'submit', text: `Send to ${subs.activeCount || 0} subscriber(s)` });
  actions.appendChild(sendBtn);
  form.appendChild(actions);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(subs.activeCount > 0)) {
      alert('No active subscribers yet. Share your publisher profile and ask people to subscribe.');
      return;
    }
    if (!confirm(`Send this update to ${subs.activeCount} subscriber(s)?`)) return;
    sendBtn.disabled = true;
    const raw = Object.fromEntries(new FormData(form).entries());
    try {
      const r = await api.post(`/publishers/${ctx.orgId}/broadcasts`, {
        kind: raw.kind,
        subject: raw.subject,
        body: raw.body,
        articleId: raw.articleId || null,
        linkUrl: raw.linkUrl || null,
      });
      alert(r.message || 'Update sent.');
      render(container, ctx);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not send update.');
      sendBtn.disabled = false;
    }
  });
  compose.appendChild(form);
  wrap.appendChild(compose);

  // Subscriber list
  const listCard = el('div', { class: 'dash-card', style: 'margin-top:18px;' });
  listCard.appendChild(el('h3', { text: 'Subscribers' }));
  if (!(subs.items || []).length) {
    listCard.appendChild(el('p', {
      style: 'color:var(--grey);font-size:13.5px;',
      text: 'No subscribers yet. On your public profile and articles, people can click “Subscribe to updates”.',
    }));
  } else {
    const table = el('div', { style: 'overflow:auto;' });
    table.innerHTML = `
      <table class="dash-table" style="width:100%;border-collapse:collapse;font-size:13.5px;">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid var(--line);">
            <th style="padding:8px 6px;">Name</th>
            <th style="padding:8px 6px;">Email</th>
            <th style="padding:8px 6px;">Status</th>
            <th style="padding:8px 6px;">Source</th>
            <th style="padding:8px 6px;">Since</th>
          </tr>
        </thead>
        <tbody>
          ${(subs.items || []).map((s) => `
            <tr style="border-bottom:1px solid var(--line);">
              <td style="padding:8px 6px;">${escapeHtml(s.displayName || '—')}</td>
              <td style="padding:8px 6px;">${escapeHtml(s.email || '—')}</td>
              <td style="padding:8px 6px;">${s.active ? 'Active' : 'Unsubscribed'}</td>
              <td style="padding:8px 6px;">${escapeHtml(s.source || '—')}</td>
              <td style="padding:8px 6px;">${escapeHtml(formatDate(s.subscribedAt))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    listCard.appendChild(table);
  }
  wrap.appendChild(listCard);

  // Sent history
  const hist = el('div', { class: 'dash-card', style: 'margin-top:18px;' });
  hist.appendChild(el('h3', { text: 'Sent updates' }));
  if (!(broadcasts.items || []).length) {
    hist.appendChild(el('p', { style: 'color:var(--grey);font-size:13.5px;', text: 'No updates sent yet.' }));
  } else {
    (broadcasts.items || []).forEach((b) => {
      const row = el('article', {
        style: 'border-bottom:1px solid var(--line);padding:12px 0;',
      });
      row.innerHTML = `
        <div style="font-family:Inconsolata,monospace;font-size:11px;text-transform:uppercase;color:var(--gold);">
          ${escapeHtml(b.kind || 'update')} · ${escapeHtml(formatDate(b.sentAt || b.createdAt))} · ${b.recipientCount || 0} recipients
        </div>
        <strong style="display:block;margin:4px 0;">${escapeHtml(b.subject)}</strong>
        <p style="margin:0;color:var(--grey);font-size:14px;white-space:pre-wrap;">${escapeHtml(String(b.body || '').slice(0, 280))}${String(b.body || '').length > 280 ? '…' : ''}</p>
        ${b.linkUrl ? `<p style="margin:6px 0 0;"><a href="${escapeHtml(b.linkUrl)}" target="_blank" rel="noopener">${escapeHtml(b.linkUrl)}</a></p>` : ''}
      `;
      hist.appendChild(row);
    });
  }
  wrap.appendChild(hist);

  container.innerHTML = '';
  container.appendChild(wrap);
}
