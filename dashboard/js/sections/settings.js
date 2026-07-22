import { api, ApiError, uploadFile } from '../api.js';
import { el, escapeHtml } from '../util.js';
import { buildDeviceAttach } from '../deviceUpload.js';

const SITE = 'https://256newsroom.com';

export async function render(container, ctx) {
  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Settings', style: 'margin-bottom:16px;' }));

  const accountCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: 'Account' }),
    el('p', {
      style: 'margin:8px 0;color:var(--grey);font-size:13px;',
      text: `Signed in as ${escapeHtml(ctx.user.email)}`,
    }),
  ]);
  wrap.appendChild(accountCard);

  // —— Publisher personalization (org mode) ——
  if (ctx.mode === 'org' && ctx.orgId) {
    let orgPayload;
    try {
      orgPayload = await api.get(`/publishers/${ctx.orgId}`);
    } catch (err) {
      wrap.appendChild(el('p', {
        style: 'color:var(--red);',
        text: err instanceof ApiError ? err.message : 'Could not load organization settings.',
      }));
      container.innerHTML = '';
      container.appendChild(wrap);
      return;
    }

    const org = orgPayload.organization || {};
    const nameChange = orgPayload.nameChange || {};
    const publicUrl = orgPayload.publicUrl
      || (org.short_path ? `${SITE}/${org.short_path}` : `${SITE}/publisher/${org.slug}`);

    const pubCard = el('div', { class: 'dash-card' });
    pubCard.appendChild(el('h3', { text: 'Publisher profile & public URL' }));
    pubCard.appendChild(el('p', {
      style: 'color:var(--grey);font-size:13.5px;margin:0 0 14px;max-width:60ch;',
      text: 'Add a profile image, update your public name (once every 30 days), and choose a short 256 Newsroom URL such as 256newsroom.com/vox.',
    }));

    // Profile image
    const imgSection = el('div', { style: 'margin-bottom:18px;' });
    imgSection.appendChild(el('h4', {
      text: 'Profile image',
      style: 'margin:0 0 8px;font-size:14px;',
    }));
    const preview = el('div', {
      style: 'width:96px;height:96px;border-radius:50%;overflow:hidden;background:#111;border:1px solid var(--line);margin-bottom:10px;display:flex;align-items:center;justify-content:center;',
    });
    if (org.logo_url) {
      const img = el('img', {
        src: org.logo_url,
        alt: 'Profile',
        style: 'width:100%;height:100%;object-fit:cover;',
      });
      preview.appendChild(img);
    } else {
      preview.appendChild(el('span', {
        style: 'color:#fff;font-weight:700;font-size:28px;',
        text: (org.name || '?').slice(0, 2).toUpperCase(),
      }));
    }
    imgSection.appendChild(preview);

    if (ctx.isEditor) {
      const attachHost = el('div');
      attachHost.appendChild(buildDeviceAttach({
        kind: 'image',
        organizationId: ctx.orgId,
        label: 'Upload profile image',
        onUploaded: async ({ url }) => {
          try {
            await api.patch(`/publishers/${ctx.orgId}`, { logoUrl: url });
            render(container, ctx);
          } catch (err) {
            alert(err instanceof ApiError ? err.message : 'Could not save profile image.');
          }
        },
      }));
      imgSection.appendChild(attachHost);
      imgSection.appendChild(el('p', {
        style: 'color:var(--grey);font-size:12px;margin:8px 0 0;',
        text: 'Shown on your articles and public publisher page.',
      }));
    }
    pubCard.appendChild(imgSection);

    // Name + short URL form
    const form = el('form', { class: 'dash-form' });
    const canRename = nameChange.canChangeNow !== false;
    const nextName = nameChange.nextAllowedAt
      ? new Date(nameChange.nextAllowedAt).toLocaleDateString('en-UG', { dateStyle: 'medium' })
      : null;

    form.innerHTML = `
      <label class="full">Publisher name
        <input name="name" maxlength="200" value="${escapeHtml(org.name || '')}" ${canRename && ctx.isEditor ? '' : 'disabled'}>
      </label>
      <p class="full" style="margin:0 0 12px;color:var(--grey);font-size:12.5px;">
        ${canRename
    ? 'You can change the public name now. After saving, the next rename is allowed in 30 days.'
    : `Name was changed recently. Next rename available after ${escapeHtml(nextName || '30 days')}.`}
      </p>
      <label class="full">Desired public URL
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-family:Inconsolata,monospace;font-size:13px;color:var(--grey);">${SITE}/</span>
          <input name="shortPath" maxlength="40" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value="${escapeHtml(org.short_path || '')}"
            placeholder="vox" style="flex:1;min-width:120px;"
            ${ctx.isEditor ? '' : 'disabled'}>
        </div>
      </label>
      <p class="full" style="margin:0 0 12px;color:var(--grey);font-size:12.5px;">
        Your page will open at <strong>${escapeHtml(publicUrl)}</strong>
        ${org.short_path ? '' : ' (set a short path like <code>vox</code> to use a custom URL).'}
        Use lowercase letters, numbers, and hyphens only.
      </p>
      <label class="full">Tagline
        <input name="tagline" maxlength="200" value="${escapeHtml(org.tagline || '')}"
          placeholder="Short line under your name" ${ctx.isEditor ? '' : 'disabled'}>
      </label>
    `;

    const msg = el('p', { class: 'full', style: 'margin:8px 0 0;font-size:13px;' });
    if (ctx.isEditor) {
      const actions = el('div', { class: 'dash-actions full' });
      actions.appendChild(el('button', { type: 'submit', text: 'Save profile settings' }));
      form.appendChild(actions);
      form.appendChild(msg);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = '';
        msg.style.color = '';
        const raw = Object.fromEntries(new FormData(form).entries());
        const body = {
          tagline: raw.tagline,
          shortPath: (raw.shortPath || '').trim() || null,
        };
        if (canRename && raw.name && raw.name.trim() !== org.name) {
          body.name = raw.name.trim();
        }
        try {
          const r = await api.patch(`/publishers/${ctx.orgId}`, body);
          msg.style.color = '#16783c';
          msg.textContent = r.publicUrl
            ? `Saved. Public page: ${r.publicUrl}`
            : 'Saved.';
          setTimeout(() => render(container, ctx), 700);
        } catch (err) {
          msg.style.color = 'var(--red)';
          msg.textContent = err instanceof ApiError ? err.message : 'Could not save settings.';
        }
      });
    } else {
      form.appendChild(el('p', {
        class: 'full',
        style: 'color:var(--grey);font-size:12.5px;',
        text: 'Only an owner or editor can change publisher settings.',
      }));
    }
    pubCard.appendChild(form);

    const link = el('p', { style: 'margin:14px 0 0;' });
    link.innerHTML = `<a href="${escapeHtml(publicUrl.replace(SITE, '') || `/publisher/${org.slug}`)}" target="_blank" rel="noopener" style="font-weight:700;color:var(--gold);">Open public page →</a>`;
    pubCard.appendChild(link);
    wrap.appendChild(pubCard);
  }

  // Password
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
