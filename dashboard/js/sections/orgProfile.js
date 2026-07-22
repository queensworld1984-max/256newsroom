import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const { organization: org } = await api.get(`/publishers/${ctx.orgId}`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Organization Profile', style: 'margin-bottom:16px;' }));

  const form = el('form', { class: 'dash-form dash-card' });
  form.innerHTML = `
    <label class="full">Description <textarea name="description" rows="4">${escapeHtml(org.description || '')}</textarea></label>
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
        await api.patch(`/publishers/${ctx.orgId}`, raw);
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
  } else {
    form.appendChild(el('p', { class: 'full', style: 'color:var(--grey);font-size:12.5px;', text: 'Only an owner or editor can edit the organization profile.' }));
  }
  wrap.appendChild(form);

  container.innerHTML = '';
  container.appendChild(wrap);
}
