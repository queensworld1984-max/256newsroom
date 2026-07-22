import { api, ApiError } from '../../api.js';
import { el, escapeHtml, formatDate } from '../../util.js';

const CONTENT_TYPES = [
  'Official Update', 'Company Announcement', 'Product Update', 'Platform Guide',
  'Product Feature', 'Service Spotlight', 'User Guide', 'Safety Notice', 'Opportunity',
  'Educational Article', 'Policy Update', 'Pricing Update', 'Event', 'Community Update',
  'Frequently Asked Question', 'Platform Overview',
];
const WEEKDAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

function toast(wrap, message, kind = 'error') {
  const existing = wrap.querySelector('.dash-toast');
  if (existing) existing.remove();
  wrap.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
}

export async function render(container, ctx, { orgId }) {
  const [{ items: platforms }, { items: domains }, { items: sources }, { items: excludedUrls }, { items: evidence }] = await Promise.all([
    api.get('/admin/ecosystem/platforms'),
    api.get(`/admin/ecosystem/platforms/${orgId}/domains`),
    api.get(`/admin/ecosystem/platforms/${orgId}/sources`),
    api.get(`/admin/ecosystem/platforms/${orgId}/excluded-urls`),
    api.get(`/admin/ecosystem/platforms/${orgId}/evidence`),
  ]);
  const platform = platforms.find((p) => String(p.id) === String(orgId));
  if (!platform) {
    container.innerHTML = '<p class="dash-empty">Platform not found.</p>';
    return;
  }

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: platform.name }),
    el('a', { href: platform.website_url, target: '_blank', rel: 'noopener', text: platform.website_url }),
  ]));

  wrap.appendChild(buildSettingsCard(wrap, ctx, container, orgId, platform));
  wrap.appendChild(buildDomainsCard(wrap, ctx, container, orgId, domains));
  wrap.appendChild(buildSourcesCard(wrap, ctx, container, orgId, sources));
  wrap.appendChild(buildExcludedUrlsCard(wrap, ctx, container, orgId, excludedUrls));
  wrap.appendChild(buildEvidenceCard(wrap, ctx, container, orgId, evidence));

  container.innerHTML = '';
  container.appendChild(wrap);
}

function buildSettingsCard(pageWrap, ctx, container, orgId, platform) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Automation settings' })]);
  const form = el('form', { class: 'dash-form' });
  const activeDays = platform.active_days || [];
  const rotation = platform.content_rotation || {};
  const eligibleTypes = platform.eligible_content_types || [];

  form.innerHTML = `
    <label>Mode
      <select name="mode">
        <option value="paused" ${platform.mode === 'paused' ? 'selected' : ''}>Paused</option>
        <option value="manual" ${platform.mode === 'manual' ? 'selected' : ''}>Manual only</option>
        <option value="draft" ${platform.mode === 'draft' ? 'selected' : ''}>Generate as draft</option>
        <option value="automatic" ${platform.mode === 'automatic' ? 'selected' : ''}>Automatic publication</option>
      </select>
    </label>
    <label>Timezone <input name="timezone" value="${escapeHtml(platform.timezone)}"></label>
    <label>Daily target <input name="dailyTarget" type="number" min="0" max="10" value="${platform.daily_target}"></label>
    <label>Daily max <input name="dailyMax" type="number" min="0" max="10" value="${platform.daily_max}"></label>
    <label>Minimum interval between articles (minutes) <input name="minIntervalMinutes" type="number" min="15" value="${platform.min_interval_minutes}"></label>
    <label class="full">Active days
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
        ${WEEKDAYS.map(([key, label]) => `<span><input type="checkbox" name="activeDay" value="${key}" ${activeDays.includes(key) ? 'checked' : ''}> ${label}</span>`).join('')}
      </div>
    </label>
    <label class="full">Eligible content types (leave all unchecked to allow any permitted type)
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
        ${CONTENT_TYPES.map((t) => `<span><input type="checkbox" name="eligibleType" value="${escapeHtml(t)}" ${eligibleTypes.includes(t) ? 'checked' : ''}> ${escapeHtml(t)}</span>`).join('')}
      </div>
    </label>
    <label class="full">Content rotation focus by day (optional — overrides the platform-wide default hint)
      <div style="display:grid;gap:6px;margin-top:4px;">
        ${WEEKDAYS.map(([key, label]) => `<div style="display:flex;gap:8px;align-items:center;"><span style="width:36px;font-weight:700;">${label}</span><input name="rotation_${key}" placeholder="e.g. Safety and educational content" value="${escapeHtml(rotation[key] || '')}" style="flex:1;"></div>`).join('')}
      </div>
    </label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const saveBtn = el('button', { type: 'submit', text: 'Save settings' });
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
    const fd = new FormData(form);
    const activeDaysValue = fd.getAll('activeDay');
    const eligibleTypesValue = fd.getAll('eligibleType');
    const contentRotation = {};
    for (const [key] of WEEKDAYS) {
      const value = fd.get(`rotation_${key}`);
      if (value) contentRotation[key] = value;
    }
    const payload = {
      mode: fd.get('mode'),
      timezone: fd.get('timezone'),
      dailyTarget: Number(fd.get('dailyTarget')),
      dailyMax: Number(fd.get('dailyMax')),
      minIntervalMinutes: Number(fd.get('minIntervalMinutes')),
      activeDays: activeDaysValue,
      eligibleContentTypes: eligibleTypesValue,
      contentRotation,
    };
    try {
      await api.patch(`/admin/ecosystem/platforms/${orgId}/settings`, payload);
      toast(pageWrap, 'Settings saved.', 'success');
      setTimeout(() => render(container, ctx, { orgId }), 700);
    } catch (err) {
      saveBtn.disabled = false;
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });

  card.appendChild(form);
  return card;
}

function buildDomainsCard(pageWrap, ctx, container, orgId, domains) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Approved domains' })]);
  const list = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;' });
  for (const d of domains) {
    const chip = el('span', { class: 'badge badge-grey', style: 'display:inline-flex;align-items:center;gap:6px;' }, [d.domain]);
    const removeBtn = el('button', { class: 'small danger', style: 'padding:2px 6px;', text: '×' });
    removeBtn.addEventListener('click', async () => {
      try {
        await api.del(`/admin/ecosystem/platforms/${orgId}/domains/${d.id}`);
        render(container, ctx, { orgId });
      } catch (err) {
        toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
    chip.appendChild(removeBtn);
    list.appendChild(chip);
  }
  if (!domains.length) list.appendChild(el('p', { class: 'dash-empty', text: 'No approved domains yet — discovery is blocked until at least one is added.' }));
  card.appendChild(list);

  const form = el('form', { style: 'display:flex;gap:8px;' });
  const input = el('input', { placeholder: 'example.com', style: 'flex:1;' });
  const btn = el('button', { type: 'submit', class: 'small', text: 'Add domain' });
  form.appendChild(input);
  form.appendChild(btn);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post(`/admin/ecosystem/platforms/${orgId}/domains`, { domain: input.value });
      render(container, ctx, { orgId });
    } catch (err) {
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  card.appendChild(form);
  return card;
}

function buildSourcesCard(pageWrap, ctx, container, orgId, sources) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Source pages' })]);
  if (!sources.length) {
    card.appendChild(el('p', { class: 'dash-empty', text: 'No source pages configured yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>URL</th><th>Label</th><th></th></tr></thead>';
    const tbody = el('tbody');
    for (const s of sources) {
      const actionsTd = el('td', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });
      const discoverBtn = el('button', { class: 'small secondary', text: 'Discover now' });
      discoverBtn.addEventListener('click', async () => {
        discoverBtn.disabled = true;
        discoverBtn.textContent = 'Fetching…';
        try {
          const result = await api.post(`/admin/ecosystem/platforms/${orgId}/discover`, { url: s.url });
          toast(pageWrap, `Snapshot saved (${result.snapshotLength} chars${result.renderedWithBrowser ? ', headless-rendered' : ''}). ${result.isNewOrChanged ? 'Content is new or changed.' : 'Unchanged since last discovery.'}`, 'success');
          setTimeout(() => render(container, ctx, { orgId }), 900);
        } catch (err) {
          discoverBtn.disabled = false;
          discoverBtn.textContent = 'Discover now';
          toast(pageWrap, err instanceof ApiError ? err.message : 'Discovery failed.');
        }
      });
      actionsTd.appendChild(discoverBtn);
      const removeBtn = el('button', { class: 'small danger', text: 'Remove' });
      removeBtn.addEventListener('click', async () => {
        try {
          await api.del(`/admin/ecosystem/platforms/${orgId}/sources/${s.id}`);
          render(container, ctx, { orgId });
        } catch (err) {
          toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actionsTd.appendChild(removeBtn);

      tbody.appendChild(el('tr', {}, [
        el('td', { text: s.url }),
        el('td', { text: s.label || '—' }),
        actionsTd,
      ]));
    }
    table.appendChild(tbody);
    card.appendChild(table);
  }

  const form = el('form', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;' });
  const urlInput = el('input', { placeholder: 'https://example.com/blog/post', style: 'flex:2;min-width:220px;' });
  const labelInput = el('input', { placeholder: 'Label (optional)', style: 'flex:1;min-width:140px;' });
  const btn = el('button', { type: 'submit', class: 'small', text: 'Add source' });
  form.appendChild(urlInput);
  form.appendChild(labelInput);
  form.appendChild(btn);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post(`/admin/ecosystem/platforms/${orgId}/sources`, { url: urlInput.value, label: labelInput.value });
      render(container, ctx, { orgId });
    } catch (err) {
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  card.appendChild(form);
  return card;
}

function buildExcludedUrlsCard(pageWrap, ctx, container, orgId, excludedUrls) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Excluded URLs' })]);
  if (!excludedUrls.length) {
    card.appendChild(el('p', { class: 'dash-empty', text: 'Nothing excluded.' }));
  } else {
    for (const u of excludedUrls) {
      const row = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--line);' });
      row.appendChild(el('span', { style: 'font-size:13px;', text: `${u.url_pattern}${u.reason ? ' — ' + u.reason : ''}` }));
      const removeBtn = el('button', { class: 'small danger', text: 'Remove' });
      removeBtn.addEventListener('click', async () => {
        try {
          await api.del(`/admin/ecosystem/platforms/${orgId}/excluded-urls/${u.id}`);
          render(container, ctx, { orgId });
        } catch (err) {
          toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      row.appendChild(removeBtn);
      card.appendChild(row);
    }
  }

  const form = el('form', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;' });
  const patternInput = el('input', { placeholder: 'URL pattern to exclude, e.g. /login', style: 'flex:2;min-width:200px;' });
  const reasonInput = el('input', { placeholder: 'Reason (optional)', style: 'flex:1;min-width:140px;' });
  const btn = el('button', { type: 'submit', class: 'small', text: 'Exclude' });
  form.appendChild(patternInput);
  form.appendChild(reasonInput);
  form.appendChild(btn);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post(`/admin/ecosystem/platforms/${orgId}/excluded-urls`, { urlPattern: patternInput.value, reason: reasonInput.value });
      render(container, ctx, { orgId });
    } catch (err) {
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  card.appendChild(form);
  return card;
}

function buildEvidenceCard(pageWrap, ctx, container, orgId, evidence) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Source evidence' })]);
  if (!evidence.length) {
    card.appendChild(el('p', { class: 'dash-empty', text: 'Nothing discovered yet. Use "Discover now" on a source above.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Page title</th><th>Discovered</th><th>Length</th><th></th></tr></thead>';
    const tbody = el('tbody');
    for (const e of evidence) {
      const genBtn = el('button', { class: 'small', text: 'Generate article from this' });
      genBtn.addEventListener('click', async () => {
        genBtn.disabled = true;
        genBtn.textContent = 'Generating… (~20-30s)';
        try {
          const result = await api.post(`/admin/ecosystem/platforms/${orgId}/generate`, { sourceEvidenceId: e.id });
          if (result.article) {
            toast(pageWrap, `Created a ${result.job.status === 'published' ? 'published' : 'draft'} article: "${result.article.title}"`, 'success');
          } else {
            toast(pageWrap, `Not generated — ${result.job.status}${result.job.error ? ': ' + result.job.error : ''}`);
          }
        } catch (err) {
          toast(pageWrap, err instanceof ApiError ? err.message : 'Generation failed.');
        } finally {
          genBtn.disabled = false;
          genBtn.textContent = 'Generate article from this';
        }
      });
      tbody.appendChild(el('tr', {}, [
        el('td', { text: e.source_page_title || '(untitled)' }),
        el('td', { text: formatDate(e.discovered_at) }),
        el('td', { text: `${e.snapshot_length ?? 0} chars` }),
        el('td', {}, [genBtn]),
      ]));
    }
    table.appendChild(tbody);
    card.appendChild(table);
  }
  return card;
}
