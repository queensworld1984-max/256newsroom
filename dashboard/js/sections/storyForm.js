import { api, ApiError } from '../api.js';
import { el, escapeHtml, formatDate, statusBadgeClass } from '../util.js';
import { storiesBasePath, storyPath } from '../storiesApi.js';
import { buildDeviceAttach } from '../deviceUpload.js';

function toast(container, message, kind = 'error') {
  const existing = container.querySelector('.dash-toast');
  if (existing) existing.remove();
  const node = el('div', { class: `dash-toast ${kind}`, text: message });
  container.prepend(node);
  try { node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { /* ignore */ }
}

function liveStoryHref(story) {
  if (!story) return null;
  if (story.internal_url) return story.internal_url;
  if (story.slug) return `/news/${story.slug}`;
  return null;
}

export async function render(container, ctx, { id }) {
  const [{ items: categories }, { items: districts }] = await Promise.all([
    api.get('/categories'),
    api.get('/districts'),
  ]);
  let journalists = [];
  if (ctx.mode === 'org') {
    try {
      const res = await api.get(`/publishers/${ctx.orgId}/journalists`);
      journalists = res.items;
    } catch {
      journalists = [];
    }
  }

  let story = null;
  if (id) {
    const res = await api.get(storyPath(ctx, id));
    story = res.item;
  }

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: story ? 'Edit Story' : 'Create Story' }),
    story ? el('span', { class: `badge ${statusBadgeClass(story.status)}`, text: story.status.replace(/_/g, ' ') }) : null,
  ].filter(Boolean)));

  // Live status strip so authors know what “published” means
  if (story?.status === 'published') {
    const href = liveStoryHref(story);
    const live = el('div', { class: 'dash-card story-live-banner' });
    live.appendChild(el('p', {
      style: 'margin:0 0 8px;font-weight:700;',
      text: 'This story is LIVE on 256 Newsroom.',
    }));
    if (href) {
      live.appendChild(el('a', {
        href,
        target: '_blank',
        rel: 'noopener',
        text: `Open live page → ${href}`,
        style: 'font-weight:700;color:var(--gold);',
      }));
    }
    live.appendChild(el('p', {
      style: 'margin:8px 0 0;color:var(--grey);font-size:12.5px;',
      text: 'Use “Save changes” to update the live page. Photo/video URLs below are what readers see.',
    }));
    wrap.appendChild(live);
  }

  // —— AI drafter (both independent + publisher) ——
  wrap.appendChild(buildAiDrafterCard(wrap));

  const form = el('form', { class: 'dash-form dash-card', id: 'story-editor-form' });
  form.innerHTML = `
    <label class="full">Title <input name="title" required maxlength="300" value="${escapeHtml(story?.title || '')}"></label>
    <label class="full">Summary <textarea name="summary" rows="2" maxlength="500">${escapeHtml(story?.summary || '')}</textarea></label>
    <label class="full">Body <textarea name="body" rows="10">${escapeHtml(story?.body || '')}</textarea></label>
    <label>Category
      <select name="categorySlug">
        <option value="">— None —</option>
        ${categories.map((c) => `<option value="${escapeHtml(c.slug)}" ${story?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </label>
    <label>District
      <select name="districtSlug">
        <option value="">— None —</option>
        ${districts.map((d) => `<option value="${escapeHtml(d.slug)}" ${story?.district_id === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </label>
    ${ctx.mode === 'org' ? `<label class="full">Byline journalist
      <select name="journalistId">
        <option value="">— Organization byline —</option>
        ${journalists.map((j) => `<option value="${j.id}" ${story?.journalist_id === j.id ? 'selected' : ''}>${escapeHtml(j.name)}</option>`).join('')}
      </select>
    </label>` : ''}
    <div class="full story-media-block" data-media-slot="image">
      <div class="story-media-label">Story photo</div>
      <p class="story-media-hint">Tap the button to pick a photo from your phone or computer (up to 100&nbsp;MB). After upload, a preview appears and the image URL is filled automatically — then click Save.</p>
      <div class="attached-media-preview" data-preview="image" ${story?.image_url ? '' : 'hidden'}>
        ${story?.image_url ? `<img src="${escapeHtml(story.image_url)}" alt="Story photo preview">` : '<img alt="Story photo preview">'}
        <p class="attached-media-label">Photo attached — remember to Save.</p>
      </div>
      <div class="device-attach-host" data-kind="image"></div>
      <label class="story-url-fallback">Image URL (auto-filled on upload) <input name="imageUrl" type="url" maxlength="1000" value="${escapeHtml(story?.image_url || '')}" placeholder="https://…"></label>
    </div>
    <label>Image credit <input name="imageCredit" maxlength="200" value="${escapeHtml(story?.image_credit || '')}"></label>
    <label class="full">Image caption <input name="imageCaption" maxlength="300" value="${escapeHtml(story?.image_caption || '')}"></label>
    <div class="full story-media-block" data-media-slot="video">
      <div class="story-media-label">Story video</div>
      <p class="story-media-hint">Attach a video (up to 2&nbsp;GB). It uploads, then the server compresses it. The watch URL is filled when ready — then Save.</p>
      <div class="attached-media-preview" data-preview="video" ${story?.video_url ? '' : 'hidden'}>
        <p class="attached-media-label">${story?.video_url ? `Video linked: ${escapeHtml(story.video_url)}` : 'Video attached'}</p>
      </div>
      <div class="device-attach-host" data-kind="video"></div>
      <label class="story-url-fallback">Video URL (auto-filled on upload) <input name="videoUrl" type="url" maxlength="1000" value="${escapeHtml(story?.video_url || '')}" placeholder="https://256newsroom.com/media/watch/…"></label>
    </div>
    <label>Tags (comma separated) <input name="tags" value="${escapeHtml((story?.tags || []).join(', '))}"></label>
    <label>External URL (source link) <input name="externalUrl" type="url" maxlength="1000" value="${escapeHtml(story?.external_url || '')}"></label>
    <label><span><input type="checkbox" name="breaking" ${story?.breaking ? 'checked' : ''}> Mark as breaking</span></label>
    <label><span><input type="checkbox" name="developing" ${story?.developing ? 'checked' : ''}> Mark as developing</span></label>
  `;

  wireDeviceAttach(form, ctx, wrap);

  const actions = el('div', { class: 'dash-actions full' });
  const saveBtn = el('button', {
    type: 'submit',
    class: story?.status === 'published' ? '' : 'secondary',
    text: story?.status === 'published' ? 'Save changes to live story' : 'Save draft',
  });
  actions.appendChild(saveBtn);

  const canAutoPublish = ctx.mode === 'independent' || (ctx.mode === 'org' && ctx.canPublish) || ctx.isGlobalAdmin;
  let publishBtn = null;
  if (canAutoPublish) {
    publishBtn = el('button', {
      type: 'button',
      text: story?.status === 'published' ? 'Save & keep live' : 'Publish live now',
    });
    actions.appendChild(publishBtn);
  } else if (ctx.mode === 'org') {
    actions.appendChild(el('span', {
      style: 'align-self:center;color:var(--red);font-size:12.5px;font-weight:700;',
      text: 'Publishing locked: this organization is not approved yet. You can still save drafts and attach media.',
    }));
  }
  form.appendChild(actions);

  function buildPayload() {
    const raw = Object.fromEntries(new FormData(form).entries());
    const payload = {
      title: raw.title,
      summary: raw.summary,
      body: raw.body,
      categorySlug: raw.categorySlug || null,
      districtSlug: raw.districtSlug || null,
      imageUrl: raw.imageUrl,
      imageCredit: raw.imageCredit,
      imageCaption: raw.imageCaption,
      videoUrl: raw.videoUrl,
      tags: raw.tags ? raw.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      externalUrl: raw.externalUrl,
      breaking: form.breaking.checked,
      developing: form.developing.checked,
    };
    if (ctx.mode === 'org' && raw.journalistId) payload.journalistId = raw.journalistId;
    return payload;
  }

  async function saveStory({ publish }) {
    if (!form.title.value.trim()) {
      toast(wrap, 'Title is required.');
      form.title.focus();
      return;
    }
    saveBtn.disabled = true;
    if (publishBtn) publishBtn.disabled = true;
    const payload = buildPayload();

    try {
      let saved = story;
      if (story) {
        const { item } = await api.patch(storyPath(ctx, story.id), payload);
        saved = item || story;
        if (publish && saved.status !== 'published') {
          const pub = await api.post(`${storyPath(ctx, story.id)}/publish`, {});
          saved = pub.item || saved;
        }
      } else {
        const { item } = await api.post(storiesBasePath(ctx), payload);
        saved = item;
        if (publish) {
          try {
            const pub = await api.post(`${storyPath(ctx, item.id)}/publish`, {});
            saved = pub.item || item;
          } catch (pubErr) {
            // Draft exists; surface publish error clearly
            window.location.hash = `/stories/${item.id}/edit`;
            throw pubErr;
          }
        }
      }

      const href = liveStoryHref(saved);
      if (publish || saved.status === 'published') {
        toast(wrap, href
          ? `Saved & live. Open: ${href}`
          : 'Saved. Story is published.', 'success');
      } else {
        toast(wrap, 'Draft saved. Use “Publish live now” when ready.', 'success');
      }

      if (!story || (publish && saved.status === 'published')) {
        setTimeout(() => {
          window.location.hash = `/stories/${saved.id}/edit`;
          if (story) render(wrap.parentElement || container, ctx, { id: saved.id });
        }, 500);
      } else {
        setTimeout(() => render(wrap.parentElement || container, ctx, { id: saved.id }), 500);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong.';
      toast(wrap, msg);
    } finally {
      saveBtn.disabled = false;
      if (publishBtn) publishBtn.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveStory({ publish: false });
  });
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      await saveStory({ publish: true });
    });
  }

  wrap.appendChild(form);

  if (story) {
    wrap.appendChild(buildWorkflowCard(wrap, ctx, story));
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}

function buildAiDrafterCard(pageWrap) {
  const card = el('div', { class: 'dash-card' });
  card.appendChild(el('h3', { text: 'AI story drafter' }));
  card.appendChild(el('p', {
    style: 'margin-bottom:10px;color:var(--grey);font-size:13px;line-height:1.5;',
    text: 'Paste notes or facts, choose how long the article should be, then generate. The AI expands notes into a full newsroom draft (title, summary, body, tags). It must not invent events, quotes, or figures not in your notes. Always edit before publishing.',
  }));

  const lengthRow = el('div', { class: 'ai-length-row' });
  lengthRow.innerHTML = `
    <label class="ai-length-label">Article length (words)
      <select name="aiWordCountPreset" id="ai-word-preset">
        <option value="short">Short — ~400 words</option>
        <option value="medium">Medium — ~700 words</option>
        <option value="long" selected>Long (recommended) — ~1,100 words</option>
        <option value="feature">Feature — ~1,500 words</option>
        <option value="custom">Custom…</option>
      </select>
    </label>
    <label class="ai-length-label ai-custom-words" hidden>Custom word count
      <input type="number" name="aiWordCountCustom" id="ai-word-custom" min="300" max="2500" step="50" value="1100" placeholder="e.g. 900">
    </label>
  `;
  const presetSelect = lengthRow.querySelector('#ai-word-preset');
  const customWrap = lengthRow.querySelector('.ai-custom-words');
  const customInput = lengthRow.querySelector('#ai-word-custom');
  presetSelect.addEventListener('change', () => {
    customWrap.hidden = presetSelect.value !== 'custom';
  });

  const notes = el('textarea', {
    name: 'aiNotes',
    rows: '6',
    placeholder: 'Who / what / where / when — quotes, figures, source names, programme lists, context… More detail = smarter draft.',
    style: 'width:100%;',
  });
  const actions = el('div', { class: 'dash-actions' });
  const btn = el('button', { type: 'button', class: 'secondary', text: 'Generate draft' });
  const status = el('span', { style: 'color:var(--grey);font-size:12.5px;' });
  actions.appendChild(btn);
  actions.appendChild(status);
  card.appendChild(lengthRow);
  card.appendChild(notes);
  card.appendChild(actions);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const preset = presetSelect.value;
    let targetLabel = preset;
    const payload = {
      notes: notes.value,
      wordCountPreset: preset === 'custom' ? undefined : preset,
    };
    if (preset === 'custom') {
      const n = Number(customInput.value);
      if (!Number.isFinite(n) || n < 300) {
        toast(pageWrap, 'Enter a custom word count between 300 and 2,500.');
        btn.disabled = false;
        return;
      }
      payload.wordCount = Math.min(2500, Math.round(n));
      targetLabel = `~${payload.wordCount} words`;
    } else {
      const map = { short: 400, medium: 700, long: 1100, feature: 1500 };
      targetLabel = `~${map[preset] || 1100} words`;
    }

    status.textContent = `Drafting ${targetLabel}… this can take up to a minute.`;
    try {
      const form = pageWrap.querySelector('#story-editor-form') || pageWrap.querySelector('form.dash-form');
      payload.title = form?.title?.value || '';
      payload.category = form?.categorySlug?.selectedOptions?.[0]?.textContent || '';
      payload.district = form?.districtSlug?.selectedOptions?.[0]?.textContent || '';

      const { draft, warning } = await api.post('/ai/draft-story', payload);
      if (form) {
        if (draft.title) form.title.value = draft.title;
        if (draft.summary) form.summary.value = draft.summary;
        if (draft.body) form.body.value = draft.body;
        if (draft.tags?.length && form.tags) form.tags.value = draft.tags.join(', ');
      }
      const wc = draft.wordCount || (draft.body || '').trim().split(/\s+/).filter(Boolean).length;
      const msg = warning
        || `Draft applied (~${wc} words; target ${draft.targetWords || targetLabel}). Review carefully.`;
      status.textContent = msg;
      toast(pageWrap, msg, warning ? 'error' : 'success');
    } catch (err) {
      status.textContent = '';
      toast(pageWrap, err instanceof ApiError ? err.message : 'AI draft failed.');
    } finally {
      btn.disabled = false;
    }
  });

  return card;
}

function setMediaPreview(form, kind, url) {
  const box = form.querySelector(`.attached-media-preview[data-preview="${kind}"]`);
  if (!box) return;
  if (!url) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  if (kind === 'image') {
    const img = box.querySelector('img');
    if (img) {
      img.src = url;
      img.onerror = () => { img.alt = 'Preview failed to load — URL may still work after save.'; };
    }
    const label = box.querySelector('.attached-media-label');
    if (label) label.textContent = 'Photo attached — click Save to keep it on the story.';
  } else {
    const label = box.querySelector('.attached-media-label');
    if (label) label.textContent = `Video linked — click Save to keep it on the story. ${url}`;
  }
}

function wireDeviceAttach(form, ctx, pageWrap) {
  const orgId = ctx.mode === 'org' && ctx.orgId ? ctx.orgId : null;

  // Live preview when URL fields change (paste)
  form.imageUrl?.addEventListener('change', () => setMediaPreview(form, 'image', form.imageUrl.value));
  form.imageUrl?.addEventListener('input', () => setMediaPreview(form, 'image', form.imageUrl.value));
  form.videoUrl?.addEventListener('change', () => setMediaPreview(form, 'video', form.videoUrl.value));

  form.querySelectorAll('.device-attach-host').forEach((host) => {
    const kind = host.getAttribute('data-kind') || 'image';
    host.appendChild(buildDeviceAttach({
      kind,
      organizationId: orgId,
      label: kind === 'video' ? 'Attach video from device' : 'Attach photo from device',
      onUploaded: ({ url, shareUrl, mediaType }) => {
        if (mediaType === 'video' || kind === 'video') {
          form.videoUrl.value = shareUrl || url;
          setMediaPreview(form, 'video', form.videoUrl.value);
          toast(pageWrap, 'Video attached. Click “Save changes” / “Save draft” to keep it on this story.', 'success');
        } else {
          form.imageUrl.value = url;
          setMediaPreview(form, 'image', url);
          toast(pageWrap, 'Photo attached. Click “Save changes” / “Save draft” to keep it on this story.', 'success');
        }
      },
    }));
  });
}

function buildWorkflowCard(pageWrap, ctx, story) {
  const card = el('div', { class: 'dash-card' }, [el('h3', { text: 'Workflow' })]);
  const actions = el('div', { class: 'dash-actions' });

  async function runAction(path, body, successMessage) {
    try {
      await api.post(path, body || {});
      toast(pageWrap, successMessage, 'success');
      setTimeout(() => render(pageWrap.parentElement, ctx, { id: story.id }), 700);
    } catch (err) {
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  // Optional editorial review remains for orgs; journalists can still publish directly when allowed.
  if (ctx.mode === 'org' && story.status === 'draft' && ctx.isEditor) {
    const btn = el('button', { class: 'secondary', text: 'Submit for Review', onclick: () => runAction(`${storyPath(ctx, story.id)}/submit-for-review`, {}, 'Submitted for review.') });
    actions.appendChild(btn);
  }

  if (ctx.mode === 'org' && story.status === 'pending_review' && ctx.isEditor) {
    const btn = el('button', { text: 'Approve', onclick: () => runAction(`${storyPath(ctx, story.id)}/approve`, {}, 'Approved.') });
    actions.appendChild(btn);
  }

  if (story.status !== 'published') {
    const dateInput = el('input', { type: 'datetime-local', style: 'width:auto;' });
    const scheduleBtn = el('button', {
      class: 'secondary',
      text: 'Schedule',
      onclick: () => {
        if (!dateInput.value) { toast(pageWrap, 'Choose a date and time first.'); return; }
        runAction(`${storyPath(ctx, story.id)}/schedule`, { scheduledPublishAt: new Date(dateInput.value).toISOString() }, 'Scheduled.');
      },
    });
    actions.appendChild(dateInput);
    actions.appendChild(scheduleBtn);
  }

  if (ctx.canPublish !== false || ctx.mode === 'independent') {
    const publishBtn = el('button', {
      text: story.status === 'scheduled' ? 'Publish now' : 'Publish live',
      onclick: () => runAction(`${storyPath(ctx, story.id)}/publish`, {}, 'Published live.'),
    });
    actions.appendChild(publishBtn);
  } else {
    card.appendChild(el('p', {
      style: 'margin-top:8px;color:var(--grey);font-size:13px;',
      text: 'Publishing is locked until this organization is approved. Independent journalists can publish under their own byline without waiting.',
    }));
  }

  if (story.status !== 'withdrawn') {
    const withdrawBtn = el('button', {
      class: 'danger',
      text: 'Withdraw',
      onclick: () => {
        const reason = prompt('Reason for withdrawing this story:');
        if (reason === null) return;
        runAction(`${storyPath(ctx, story.id)}/withdraw`, { reason }, 'Withdrawn.');
      },
    });
    actions.appendChild(withdrawBtn);
  }

  // Platform admins can permanently delete any story from the editor.
  if (ctx.isGlobalAdmin) {
    const delBtn = el('button', {
      class: 'danger',
      text: 'Delete permanently',
      onclick: async () => {
        if (!confirm(`Permanently delete this story?\n\n#${story.id}\n${story.title || ''}`)) return;
        if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
        try {
          await api.del(`/admin/people/stories/${story.id}`);
          toast(pageWrap, 'Story deleted.', 'success');
          setTimeout(() => { window.location.hash = ctx.mode === 'admin' ? '#/admin/stories' : '#/stories'; }, 600);
        } catch (err) {
          toast(pageWrap, err instanceof ApiError ? err.message : 'Could not delete story.');
        }
      },
    });
    actions.appendChild(delBtn);
  }

  card.appendChild(actions);

  if (story.status === 'scheduled' && story.scheduled_publish_at) {
    card.appendChild(el('p', { style: 'margin-top:10px;color:var(--grey);font-size:13px;', text: `Scheduled for ${formatDate(story.scheduled_publish_at)}` }));
  }

  if (story.status === 'published') {
    card.appendChild(buildCorrectionForm(pageWrap, ctx, story));
  }

  return card;
}

function buildCorrectionForm(pageWrap, ctx, story) {
  const section = el('div', { style: 'margin-top:18px;border-top:1px solid var(--line);padding-top:14px;' }, [el('h4', { text: 'Add a correction', style: 'margin-bottom:10px;' })]);
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">What changed <textarea name="note" rows="2" placeholder="Describe the correction"></textarea></label>
    <label class="full">New headline (optional) <input name="newHeadline" value="${escapeHtml(story.title)}"></label>
    <label class="full">New body (optional) <textarea name="newBody" rows="6">${escapeHtml(story.body || '')}</textarea></label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const submitBtn = el('button', { type: 'submit', class: 'secondary', text: 'Publish correction' });
  actions.appendChild(submitBtn);
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitBtn.disabled = true;
    const raw = Object.fromEntries(new FormData(form).entries());
    const payload = { note: raw.note };
    if (raw.newHeadline && raw.newHeadline !== story.title) payload.newHeadline = raw.newHeadline;
    if (raw.newBody !== story.body) payload.newBody = raw.newBody;
    try {
      await api.post(`${storyPath(ctx, story.id)}/corrections`, payload);
      toast(pageWrap, 'Correction published.', 'success');
      setTimeout(() => render(pageWrap.parentElement, ctx, { id: story.id }), 700);
    } catch (err) {
      submitBtn.disabled = false;
      toast(pageWrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });

  section.appendChild(form);
  return section;
}
