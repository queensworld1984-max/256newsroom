import { api, ApiError } from '../api.js';
import { el } from '../util.js';

export async function render(container) {
  const { item } = await api.get('/auth/journalist-profile');
  const wrap = el('div');
  const topics = Array.isArray(item.topic_slugs) ? item.topic_slugs.join(', ') : (item.beat || '');
  wrap.innerHTML = `<div class="dash-card"><h2>My public journalist profile</h2>
    <p style="margin:8px 0 16px;color:var(--grey)">Readers can find this profile through newsroom search and the journalist directory. National ID is never shown publicly (last4 on file for newsroom verification only).</p>
    <form class="dash-form" id="journalist-profile-form">
    <label>Public name <input name="name" required value="${escapeAttr(item.name)}"></label>
    <label>Reporting beat <input name="beat" value="${escapeAttr(item.beat)}" placeholder="Politics, health, sports…"></label>
    <label>District <input value="${escapeAttr(item.district_name || item.location || '')}" disabled></label>
    <label>Topics <input value="${escapeAttr(topics)}" disabled></label>
    <label>Location <input name="location" value="${escapeAttr(item.location)}" placeholder="Kampala, Uganda"></label>
    <label>Website <input name="websiteUrl" type="url" value="${escapeAttr(item.website_url)}" placeholder="https://"></label>
    <label class="full">Profile photo URL <input name="imageUrl" type="url" value="${escapeAttr(item.image_url)}" placeholder="https://"></label>
    <label class="full">Biography <textarea name="bio" rows="7" maxlength="2000">${escapeText(item.bio)}</textarea></label>
    <p class="full" style="color:var(--grey);font-size:12px;margin:0;">Contact on file: ${escapeHtml(item.contact_email || '—')} · WhatsApp ${escapeHtml(item.whatsapp_number || '—')} · Phone ${escapeHtml(item.contact_phone || '—')} · NIN …${escapeHtml(item.national_id_last4 || '—')}</p>
    <div class="dash-actions full"><button type="submit">Save public profile</button><a href="/journalists/profile.html?slug=${encodeURIComponent(item.slug)}" target="_blank">View public profile</a></div><p class="auth-error full"></p>
  </form></div>`;
  const form = wrap.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    const error = form.querySelector('.auth-error');
    button.disabled = true;
    error.textContent = '';
    try {
      await api.patch('/auth/journalist-profile', Object.fromEntries(new FormData(form)));
      button.textContent = 'Saved';
      setTimeout(() => { button.textContent = 'Save public profile'; }, 1500);
    } catch (err) {
      error.textContent = err instanceof ApiError ? err.message : 'Could not save profile.';
    } finally {
      button.disabled = false;
    }
  });
  container.innerHTML = '';
  container.appendChild(wrap);
}
function escapeAttr(v = '') {
  return String(v || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function escapeText(v = '') {
  return String(v || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeHtml(v = '') {
  return String(v || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
