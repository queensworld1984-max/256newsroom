import { api, ApiError, uploadFile } from '../api.js';
import { el, escapeHtml, formatDate, statusBadgeClass } from '../util.js';
import { storiesBasePath, storyPath } from '../storiesApi.js';

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
    <label class="full">Image
      <input name="imageUrl" type="url" maxlength="1000" value="${escapeHtml(story?.image_url || '')}" placeholder="https://… or upload below">
      <div class="media-upload-row" data-upload="image">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="media-file-input">
        <button type="button" class="secondary small media-upload-btn">Upload image</button>
        <span class="media-upload-status" style="color:var(--grey);font-size:12px;"></span>
      </div>
    </label>
    <label>Image credit <input name="imageCredit" maxlength="200" value="${escapeHtml(story?.image_credit || '')}"></label>
    <label class="full">Image caption <input name="imageCaption" maxlength="300" value="${escapeHtml(story?.image_caption || '')}"></label>
    <label class="full">Video (shareable watch URL)
      <input name="videoUrl" type="url" maxlength="1000" value="${escapeHtml(story?.video_url || '')}" placeholder="https://256newsroom.com/media/watch/…">
      <div class="media-upload-row" data-upload="video">
        <input type="file" accept="video/mp4,video/webm,video/quicktime" class="media-file-input">
        <button type="button" class="secondary small media-upload-btn">Upload video</button>
        <span class="media-upload-status" style="color:var(--grey);font-size:12px;"></span>
      </div>
      <span style="color:var(--grey);font-size:12px;font-weight:400;text-transform:none;letter-spacing:0;font-family:inherit;">Uploads create a public watch page URL (like YouTube). MP4/WebM/MOV, up to 200&nbsp;MB.</span>
    </label>
    <label>Tags (comma separated) <input name="tags" value="${escapeHtml((story?.tags || []).join(', '))}"></label>
    <label>External URL (source link) <input name="externalUrl" type="url" maxlength="1000" value="${escapeHtml(story?.external_url || '')}"></label>
    <label><span><input type="checkbox" name="breaking" ${story?.breaking ? 'checked' : ''}> Mark as breaking</span></label>
    <label><span><input type="checkbox" name="developing" ${story?.developing ? 'checked' : ''}> Mark as developing</span></label>
  `;

  wireMediaUploads(form, ctx, wrap);

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

function wireMediaUploads(form, ctx, pageWrap) {
  form.querySelectorAll('.media-upload-row').forEach((row) => {
    const kind = row.getAttribute('data-upload');
    const fileInput = row.querySelector('.media-file-input');
    const btn = row.querySelector('.media-upload-btn');
    const status = row.querySelector('.media-upload-status');
    btn.addEventListener('click', async () => {
      if (!fileInput.files?.length) {
        fileInput.click();
        return;
      }
      btn.disabled = true;
      status.textContent = 'Uploading…';
      try {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        if (ctx.mode === 'org' && ctx.orgId) fd.append('organizationId', String(ctx.orgId));
        const result = await uploadFile('/media/upload', fd);
        if (kind === 'video') {
          form.videoUrl.value = result.shareUrl || result.url;
          status.textContent = 'Video ready — shareable watch URL filled in.';
        } else {
          form.imageUrl.value = result.url;
          status.textContent = 'Image uploaded.';
        }
        toast(pageWrap, kind === 'video' ? 'Video uploaded. Watch URL is ready to share.' : 'Image uploaded.', 'success');
        fileInput.value = '';
      } catch (err) {
        status.textContent = '';
        toast(pageWrap, err instanceof ApiError ? err.message : 'Upload failed.');
      } finally {
        btn.disabled = false;
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) {
        status.textContent = fileInput.files[0].name;
      }
    });
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
