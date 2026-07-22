import { api, ApiError } from '../api.js';
import { el, escapeHtml, formatDate, statusBadgeClass } from '../util.js';
import { storiesBasePath, storyPath } from '../storiesApi.js';
import { buildDeviceAttach } from '../deviceUpload.js';

function toast(container, message, kind = 'error') {
  const existing = container.querySelector('.dash-toast');
  if (existing) existing.remove();
  container.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
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

  // —— AI drafter (both independent + publisher) ——
  wrap.appendChild(buildAiDrafterCard(wrap));

  const form = el('form', { class: 'dash-form dash-card' });
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
      <p class="story-media-hint">Attach a photo directly from your phone gallery or computer. Optional: paste an external URL.</p>
      <div class="device-attach-host" data-kind="image"></div>
      <label class="story-url-fallback">Or image URL <input name="imageUrl" type="url" maxlength="1000" value="${escapeHtml(story?.image_url || '')}" placeholder="https://…"></label>
    </div>
    <label>Image credit <input name="imageCredit" maxlength="200" value="${escapeHtml(story?.image_credit || '')}"></label>
    <label class="full">Image caption <input name="imageCaption" maxlength="300" value="${escapeHtml(story?.image_caption || '')}"></label>
    <div class="full story-media-block" data-media-slot="video">
      <div class="story-media-label">Story video</div>
      <p class="story-media-hint">Attach a video from your device. Creates a shareable watch URL (like YouTube). MP4/WebM/MOV, up to 200&nbsp;MB.</p>
      <div class="device-attach-host" data-kind="video"></div>
      <label class="story-url-fallback">Or video URL <input name="videoUrl" type="url" maxlength="1000" value="${escapeHtml(story?.video_url || '')}" placeholder="https://256newsroom.com/media/watch/…"></label>
    </div>
    <label>Tags (comma separated) <input name="tags" value="${escapeHtml((story?.tags || []).join(', '))}"></label>
    <label>External URL (source link) <input name="externalUrl" type="url" maxlength="1000" value="${escapeHtml(story?.external_url || '')}"></label>
    <label><span><input type="checkbox" name="breaking" ${story?.breaking ? 'checked' : ''}> Mark as breaking</span></label>
    <label><span><input type="checkbox" name="developing" ${story?.developing ? 'checked' : ''}> Mark as developing</span></label>
  `;

  wireDeviceAttach(form, ctx, wrap);

  const actions = el('div', { class: 'dash-actions full' });
  const saveBtn = el('button', { type: 'submit', text: story ? 'Save Changes' : 'Save Draft' });
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
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

    try {
      if (story) {
        await api.patch(storyPath(ctx, story.id), payload);
        toast(wrap, 'Saved.', 'success');
      } else {
        const { item } = await api.post(storiesBasePath(ctx), payload);
        window.location.hash = `/stories/${item.id}/edit`;
        return;
      }
    } catch (err) {
      toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      saveBtn.disabled = false;
    }
  });

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
    style: 'margin-bottom:10px;color:var(--grey);font-size:13px;',
    text: 'Paste notes or facts. The drafter fills title, summary, body, and tags — it will not invent events not in your notes. Always edit before publishing.',
  }));

  const notes = el('textarea', { name: 'aiNotes', rows: '5', placeholder: 'Who / what / where / when — quotes, figures, source names…', style: 'width:100%;' });
  const actions = el('div', { class: 'dash-actions' });
  const btn = el('button', { type: 'button', class: 'secondary', text: 'Generate draft' });
  const status = el('span', { style: 'color:var(--grey);font-size:12.5px;' });
  actions.appendChild(btn);
  actions.appendChild(status);
  card.appendChild(notes);
  card.appendChild(actions);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'Drafting…';
    try {
      const form = pageWrap.querySelector('form.dash-form');
      const { draft, warning } = await api.post('/ai/draft-story', {
        notes: notes.value,
        title: form?.title?.value || '',
        category: form?.categorySlug?.selectedOptions?.[0]?.textContent || '',
        district: form?.districtSlug?.selectedOptions?.[0]?.textContent || '',
      });
      if (form) {
        if (draft.title) form.title.value = draft.title;
        if (draft.summary) form.summary.value = draft.summary;
        if (draft.body) form.body.value = draft.body;
        if (draft.tags?.length && form.tags) form.tags.value = draft.tags.join(', ');
      }
      status.textContent = warning || 'Draft applied — review carefully.';
      toast(pageWrap, warning || 'AI draft applied to the form.', warning ? 'error' : 'success');
    } catch (err) {
      status.textContent = '';
      toast(pageWrap, err instanceof ApiError ? err.message : 'AI draft failed.');
    } finally {
      btn.disabled = false;
    }
  });

  return card;
}

function wireDeviceAttach(form, ctx, pageWrap) {
  const orgId = ctx.mode === 'org' && ctx.orgId ? ctx.orgId : null;

  form.querySelectorAll('.device-attach-host').forEach((host) => {
    const kind = host.getAttribute('data-kind') || 'image';
    host.appendChild(buildDeviceAttach({
      kind,
      organizationId: orgId,
      label: kind === 'video' ? 'Attach video from device' : 'Attach photo from device',
      onUploaded: ({ url, shareUrl, mediaType }) => {
        if (mediaType === 'video' || kind === 'video') {
          form.videoUrl.value = shareUrl || url;
          toast(pageWrap, 'Video attached from your device.', 'success');
        } else {
          form.imageUrl.value = url;
          toast(pageWrap, 'Photo attached from your device.', 'success');
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

  if (ctx.mode === 'org' && story.status === 'draft') {
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

  const publishBtn = el('button', { text: story.status === 'scheduled' ? 'Publish now' : 'Publish', onclick: () => runAction(`${storyPath(ctx, story.id)}/publish`, {}, 'Published.') });
  actions.appendChild(publishBtn);

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
