import { api, ApiError } from '../api.js';
import { el, escapeHtml, formatDate } from '../util.js';

function toast(wrap, message, kind = 'error') {
  const existing = wrap.querySelector('.dash-toast');
  if (existing) existing.remove();
  wrap.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
}

export async function render(container, ctx) {
  const [{ items: feeds }, { items: categories }, { items: districts }] = await Promise.all([
    api.get(`/publishers/${ctx.orgId}/feeds`),
    api.get('/categories'),
    api.get('/districts'),
  ]);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'External RSS', style: 'margin-bottom:16px;' }));

  const formCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: 'Connect a feed' }),
    el('p', { style: 'margin:8px 0 12px;color:var(--grey);font-size:12.5px;', text: 'New feeds always start in draft mode. You can turn on auto-publish afterward once your organization is approved and the feed’s website is domain-verified.' }),
  ]);
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Feed URL <input name="feedUrl" type="url" required placeholder="https://yoursite.com/feed.xml"></label>
    <label>Category
      <select name="categorySlug">
        <option value="">— None —</option>
        ${categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </label>
    <label>District
      <select name="districtSlug">
        <option value="">— None —</option>
        ${districts.map((d) => `<option value="${escapeHtml(d.slug)}">${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </label>
    <label>Import content
      <select name="contentMode">
        <option value="headline_summary_image">Summary & image</option>
        <option value="headline_only">Headline & link only</option>
      </select>
    </label>
    <label>Check for new items every
      <select name="pollIntervalMinutes">
        <option value="15">15 minutes</option>
        <option value="30" selected>30 minutes</option>
        <option value="60">1 hour</option>
        <option value="180">3 hours</option>
      </select>
    </label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const btn = el('button', { type: 'submit', text: 'Connect feed' });
  actions.appendChild(btn);
  form.appendChild(actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    btn.disabled = true;
    const raw = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post(`/publishers/${ctx.orgId}/feeds`, raw);
      render(container, ctx);
    } catch (err) {
      btn.disabled = false;
      toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  formCard.appendChild(form);
  wrap.appendChild(formCard);

  if (!feeds.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No feeds connected yet.' })]));
  } else {
    for (const feed of feeds) wrap.appendChild(buildFeedCard(container, ctx, feed, categories, districts));
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}

function buildFeedCard(container, ctx, feed, categories, districts) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('div', { class: 'dash-section-title' }, [
    el('span', { style: 'font-weight:700;word-break:break-all;', text: feed.feed_url }),
    el('span', { class: `badge ${feed.active ? 'badge-green' : 'badge-grey'}`, text: feed.active ? 'Active' : 'Paused' }),
  ]));

  const meta = el('p', { style: 'color:var(--grey);font-size:12.5px;margin-bottom:10px;' });
  meta.innerHTML = [
    `Publish mode: <b>${escapeHtml((feed.publish_mode || 'draft').replace('_', ' '))}</b>`,
    `Content: ${escapeHtml((feed.content_mode || 'headline_summary_image').replace(/_/g, ' '))}`,
    `Domain verified: ${feed.domain_verified_at ? 'Yes' : 'No'}`,
    feed.admin_auto_publish_override ? 'Admin override: enabled' : null,
    `Last polled: ${formatDate(feed.last_polled_at)}`,
    feed.last_error ? `Last error: ${escapeHtml(feed.last_error)}` : null,
  ].filter(Boolean).join(' · ');
  card.appendChild(meta);

  const actions = el('div', { class: 'dash-actions' });

  const pollBtn = el('button', { class: 'small secondary', text: 'Poll now' });
  pollBtn.addEventListener('click', async () => {
    pollBtn.disabled = true;
    try {
      const result = await api.post(`/publishers/${ctx.orgId}/feeds/${feed.id}/poll-now`);
      toast(card, `Found ${result.itemsFound ?? 0}, imported ${result.itemsImported ?? 0} new.`, 'success');
      setTimeout(() => render(container, ctx), 900);
    } catch (err) {
      pollBtn.disabled = false;
      toast(card, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  actions.appendChild(pollBtn);

  const toggleBtn = el('button', { class: 'small secondary', text: feed.active ? 'Pause' : 'Resume' });
  toggleBtn.addEventListener('click', async () => {
    try {
      await api.patch(`/publishers/${ctx.orgId}/feeds/${feed.id}`, { active: !feed.active });
      render(container, ctx);
    } catch (err) {
      toast(card, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  actions.appendChild(toggleBtn);

  const previewBtn = el('button', { class: 'small secondary', text: 'Preview' });
  const previewBox = el('div', { style: 'display:none;margin-top:10px;' });
  previewBtn.addEventListener('click', async () => {
    if (previewBox.style.display !== 'none') { previewBox.style.display = 'none'; return; }
    previewBox.innerHTML = '<p class="dash-empty">Loading preview…</p>';
    previewBox.style.display = 'block';
    try {
      const { items } = await api.get(`/publishers/${ctx.orgId}/feeds/${feed.id}/preview`);
      previewBox.innerHTML = '';
      if (!items.length) previewBox.appendChild(el('p', { class: 'dash-empty', text: 'No items found in this feed.' }));
      for (const item of items.slice(0, 5)) {
        previewBox.appendChild(el('div', { style: 'border-top:1px solid var(--line);padding:8px 0;' }, [
          el('div', { style: 'font-weight:700;font-size:13px;', text: item.title }),
          el('div', { style: 'color:var(--grey);font-size:12px;', text: formatDate(item.publishedAt) }),
        ]));
      }
    } catch (err) {
      previewBox.innerHTML = '';
      toast(card, err instanceof ApiError ? err.message : 'Could not load preview.');
    }
  });
  actions.appendChild(previewBtn);

  if (!feed.domain_verified_at) {
    const verifyBtn = el('button', { class: 'small secondary', text: 'Verify domain' });
    const verifyBox = el('div', { style: 'display:none;margin-top:10px;' });
    verifyBtn.addEventListener('click', async () => {
      if (verifyBox.style.display !== 'none') { verifyBox.style.display = 'none'; return; }
      try {
        const { instructions } = await api.post(`/publishers/${ctx.orgId}/feeds/${feed.id}/verify/start`);
        verifyBox.style.display = 'block';
        verifyBox.innerHTML = '';
        verifyBox.appendChild(el('p', { style: 'font-size:12.5px;margin-bottom:8px;', text: instructions }));
        const checkBtn = el('button', { class: 'small', text: 'I’ve added it — check now' });
        checkBtn.addEventListener('click', async () => {
          try {
            await api.post(`/publishers/${ctx.orgId}/feeds/${feed.id}/verify/check`);
            render(container, ctx);
          } catch (err) {
            toast(card, err instanceof ApiError ? err.message : 'Verification failed.');
          }
        });
        verifyBox.appendChild(checkBtn);
      } catch (err) {
        toast(card, err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
    actions.appendChild(verifyBtn);
    card.appendChild(verifyBox);
  }

  const deleteBtn = el('button', { class: 'small danger', text: 'Remove' });
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('Remove this feed connection? Already-imported stories are kept.')) return;
    try {
      await api.del(`/publishers/${ctx.orgId}/feeds/${feed.id}`);
      render(container, ctx);
    } catch (err) {
      toast(card, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  actions.appendChild(deleteBtn);

  card.appendChild(actions);
  card.appendChild(previewBox);

  const settingsForm = el('form', { class: 'dash-form', style: 'margin-top:14px;border-top:1px solid var(--line);padding-top:12px;' });
  settingsForm.innerHTML = `
    <label>Category
      <select name="categorySlug">
        <option value="">— None —</option>
        ${categories.map((c) => `<option value="${escapeHtml(c.slug)}" ${feed.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </label>
    <label>District
      <select name="districtSlug">
        <option value="">— None —</option>
        ${districts.map((d) => `<option value="${escapeHtml(d.slug)}" ${feed.district_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </label>
    <label>Content mode
      <select name="contentMode">
        <option value="headline_summary_image" ${feed.content_mode !== 'headline_only' ? 'selected' : ''}>Summary & image</option>
        <option value="headline_only" ${feed.content_mode === 'headline_only' ? 'selected' : ''}>Headline & link only</option>
      </select>
    </label>
    <label>Publish mode
      <select name="publishMode">
        <option value="draft" ${feed.publish_mode !== 'auto_publish' ? 'selected' : ''}>Import as draft</option>
        <option value="auto_publish" ${feed.publish_mode === 'auto_publish' ? 'selected' : ''}>Auto-publish</option>
      </select>
    </label>
  `;
  const settingsActions = el('div', { class: 'dash-actions full' });
  const saveBtn = el('button', { type: 'submit', class: 'small secondary', text: 'Save feed settings' });
  settingsActions.appendChild(saveBtn);
  settingsForm.appendChild(settingsActions);
  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(settingsForm).entries());
    try {
      await api.patch(`/publishers/${ctx.orgId}/feeds/${feed.id}`, raw);
      render(container, ctx);
    } catch (err) {
      toast(card, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  card.appendChild(settingsForm);

  return card;
}
