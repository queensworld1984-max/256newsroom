import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Settings', style: 'margin-bottom:16px;' }));

  const accountCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: 'Account' }),
    el('p', { style: 'margin:8px 0;color:var(--grey);font-size:13px;', text: `Signed in as ${escapeHtml(ctx.user.email)}` }),
  ]);
  wrap.appendChild(accountCard);

  const pwCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Change password' })]);
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label>Current password <input name="currentPassword" type="password" required autocomplete="current-password"></label>
    <label>New password (min 10 characters) <input name="newPassword" type="password" required minlength="10" autocomplete="new-password"></label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const btn = el('button', { type: 'submit', text: 'Update password' });
  const msg = el('p', { class: 'auth-error full' });
  actions.appendChild(btn);
  form.appendChild(actions);
  form.appendChild(msg);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = '';
    msg.style.color = '';
    const raw = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post('/auth/change-password', raw);
      form.reset();
      msg.style.color = '#16783c';
      msg.textContent = 'Password updated.';
    } catch (err) {
      msg.textContent = err instanceof ApiError ? err.message : 'Something went wrong.';
    }
  });
  pwCard.appendChild(form);
  wrap.appendChild(pwCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
