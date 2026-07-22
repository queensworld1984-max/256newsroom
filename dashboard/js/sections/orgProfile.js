import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const [{ organization: org }, workRes] = await Promise.all([
    api.get(`/publishers/${ctx.orgId}`),
    api.get(`/publishers/${ctx.orgId}/work-profiles`).catch(() => ({ items: [] })),
  ]);
  const workItems = workRes.items || [];

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Organization Profile', style: 'margin-bottom:8px;' }));
  wrap.appendChild(el('p', {
    style: 'color:var(--grey);font-size:13px;margin:0 0 16px;',
    text: 'Public profile shown above each story and on your publisher page (LinkedIn-style biography, practice areas, and work history).',
  }));

  const publicLink = org.slug
    ? el('p', { style: 'margin:0 0 16px;' }, [
      el('a', {
        href: `/publisher/${org.slug}`,
        target: '_blank',
        rel: 'noopener',
        text: `View public profile → /publisher/${org.slug}`,
        style: 'font-weight:700;color:var(--gold);',
      }),
    ])
    : null;
  if (publicLink) wrap.appendChild(publicLink);

  const form = el('form', { class: 'dash-form dash-card' });
  const areas = Array.isArray(org.areas_of_practice)
    ? org.areas_of_practice.join(', ')
    : (org.areas_of_practice || '');
  form.innerHTML = `
    <label class="full">Tagline <input name="tagline" maxlength="200" value="${escapeHtml(org.tagline || '')}" placeholder="Short public line under your name"></label>
    <label class="full">Short description <textarea name="description" rows="3">${escapeHtml(org.description || '')}</textarea></label>
    <label class="full">Biography (full about) <textarea name="biography" rows="6" placeholder="Tell readers who you are, your mission, and editorial focus…">${escapeHtml(org.biography || '')}</textarea></label>
    <label>Areas of practice (comma separated) <input name="areasOfPractice" value="${escapeHtml(areas)}" placeholder="Politics, Business, Investigative, Health"></label>
    <label>Years in journalism <input name="yearsInJournalism" type="number" min="0" max="120" value="${org.years_in_journalism ?? ''}"></label>
    <label>Founded year <input name="foundedYear" type="number" min="1800" max="2100" value="${org.founded_year ?? ''}"></label>
    <label>Headquarters <input name="headquarters" maxlength="200" value="${escapeHtml(org.headquarters || '')}" placeholder="Kampala, Uganda"></label>
    <label>Logo URL <input name="logoUrl" type="url" value="${escapeHtml(org.logo_url || '')}"></label>
    <label>Website URL <input name="websiteUrl" type="url" value="${escapeHtml(org.website_url || '')}"></label>
    <label>Editorial contact email <input name="editorialContactEmail" type="email" value="${escapeHtml(org.editorial_contact_email || '')}"></label>
    <label>Editorial contact phone <input name="editorialContactPhone" value="${escapeHtml(org.editorial_contact_phone || '')}"></label>
  `;
  const disabled = !ctx.isEditor;
  if (disabled) {
    form.querySelectorAll('input, textarea').forEach((i) => { i.disabled = true; });
  }
  const actions = el('div', { class: 'dash-actions full' });
  if (ctx.isEditor) {
    const btn = el('button', { type: 'submit', text: 'Save Profile' });
    actions.appendChild(btn);
    form.appendChild(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      try {
        await api.patch(`/publishers/${ctx.orgId}`, {
          ...raw,
          yearsInJournalism: raw.yearsInJournalism === '' ? null : Number(raw.yearsInJournalism),
          foundedYear: raw.foundedYear === '' ? null : Number(raw.foundedYear),
        });
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
  } else {
    form.appendChild(el('p', {
      class: 'full',
      style: 'color:var(--grey);font-size:12.5px;',
      text: 'Only an owner or editor can edit the organization profile.',
    }));
  }
  wrap.appendChild(form);

  // Work profiles
  const workCard = el('div', { class: 'dash-card', style: 'margin-top:18px;' });
  workCard.appendChild(el('h3', { text: 'Work & experience (LinkedIn-style)' }));
  workCard.appendChild(el('p', {
    style: 'color:var(--grey);font-size:13px;margin:0 0 12px;',
    text: 'Add past and current newsroom roles, years, and descriptions shown on your public publisher profile.',
  }));

  const list = el('div', { class: 'work-admin-list' });
  if (!workItems.length) {
    list.appendChild(el('p', { style: 'color:var(--grey);font-size:13px;', text: 'No work entries yet.' }));
  } else {
    workItems.forEach((w) => {
      const row = el('div', {
        style: 'border:1px solid var(--line);padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:12px;align-items:start;',
      });
      const years = w.is_current
        ? `${w.start_year || '?'} – Present`
        : `${w.start_year || '?'} – ${w.end_year || '?'}`;
      const meta = el('div');
      meta.innerHTML = `<strong>${escapeHtml(w.title)}</strong><div style="font-size:13px;color:var(--grey);">${escapeHtml(w.organization_name)} · ${escapeHtml(years)}</div>${w.description ? `<p style="margin:6px 0 0;font-size:13.5px;">${escapeHtml(w.description)}</p>` : ''}`;
      row.appendChild(meta);
      if (ctx.isEditor) {
        const del = el('button', {
          type: 'button',
          class: 'secondary',
          text: 'Remove',
          onclick: async () => {
            if (!confirm('Remove this work entry?')) return;
            try {
              await api.del(`/publishers/${ctx.orgId}/work-profiles/${w.id}`);
              render(container, ctx);
            } catch (err) {
              alert(err instanceof ApiError ? err.message : 'Could not remove.');
            }
          },
        });
        row.appendChild(del);
      }
      list.appendChild(row);
    });
  }
  workCard.appendChild(list);

  if (ctx.isEditor) {
    const addForm = el('form', { class: 'dash-form', style: 'margin-top:14px;border-top:1px solid var(--line);padding-top:14px;' });
    addForm.innerHTML = `
      <label>Role / title <input name="title" required maxlength="200" placeholder="Editor, Correspondent…"></label>
      <label>Organization / outlet <input name="organizationName" required maxlength="200" placeholder="Newsroom or company name"></label>
      <label>Location <input name="location" maxlength="200" placeholder="Kampala"></label>
      <label>Start year <input name="startYear" type="number" min="1950" max="2100"></label>
      <label>End year <input name="endYear" type="number" min="1950" max="2100"></label>
      <label><span><input type="checkbox" name="isCurrent"> Current role</span></label>
      <label class="full">Description <textarea name="description" rows="3" maxlength="4000" placeholder="What you covered, achievements…"></textarea></label>
    `;
    const addBtn = el('button', { type: 'submit', text: 'Add work entry' });
    const act = el('div', { class: 'dash-actions full' });
    act.appendChild(addBtn);
    addForm.appendChild(act);
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = Object.fromEntries(new FormData(addForm).entries());
      try {
        await api.post(`/publishers/${ctx.orgId}/work-profiles`, {
          title: raw.title,
          organizationName: raw.organizationName,
          location: raw.location || null,
          startYear: raw.startYear || null,
          endYear: raw.endYear || null,
          isCurrent: Boolean(addForm.isCurrent?.checked),
          description: raw.description || null,
        });
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Could not add work entry.');
      }
    });
    workCard.appendChild(addForm);
  }

  wrap.appendChild(workCard);
  container.innerHTML = '';
  container.appendChild(wrap);
}
