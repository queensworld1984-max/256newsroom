import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const wrap = el('div');
  let applications = [];
  try {
    const { items } = await api.get('/publisher-applications/mine');
    applications = items;
  } catch {
    // no applications yet
  }

  wrap.appendChild(el('div', { class: 'dash-card' }, [
    el('h2', { text: 'Choose how you publish' }),
    el('p', {
      style: 'color:var(--grey);font-size:13px;line-height:1.55;',
      text: 'One account can become either an independent journalist (self-serve with National ID) or apply as a publisher organization (admin review required before publishing). Both get the same story tools: AI drafter, image upload, and video upload with a shareable watch URL.',
    }),
  ]));

  if (applications.length) {
    const app = applications[0];
    wrap.appendChild(el('div', { class: 'dash-card' }, [
      el('h2', { text: 'Your publisher application' }),
      el('p', {}, [
        `${escapeHtml(app.name)} — stage: `,
        el('span', { class: 'badge badge-gold', text: app.stage.replace(/_/g, ' ') }),
      ]),
      el('p', {
        style: 'margin-top:8px;color:var(--grey);font-size:13px;',
        text: app.stage === 'rejected'
          ? 'This application was not approved. Contact the newsroom team if you believe this is an error.'
          : 'An admin will review your organization details (address and contact person). Publishing stays locked until the organization is approved. You can draft stories after the application creates your owner role.',
      }),
    ]));
  }

  const grid = el('div', { class: 'onboard-grid' });
  grid.appendChild(await buildJournalistCard(ctx));
  grid.appendChild(buildPublisherCard(!!applications.length));
  wrap.appendChild(grid);

  return wrap;
}

async function buildJournalistCard(ctx) {
  let districts = [];
  let categories = [];
  try {
    const [d, c] = await Promise.all([api.get('/districts'), api.get('/categories')]);
    districts = d.items || [];
    categories = c.items || [];
  } catch {
    // taxonomy may be unavailable offline
  }

  const card = el('div', { class: 'dash-card onboard-card' });
  card.appendChild(el('h2', { text: 'Independent journalist' }));
  card.appendChild(el('p', {
    style: 'margin-bottom:12px;color:var(--grey);font-size:13px;line-height:1.5;',
    text: 'For individuals writing under their own byline. Register with your National ID, primary district, beats, and contact details. You can draft and publish immediately after registration.',
  }));

  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Public name (byline)
      <input name="displayName" required maxlength="160" placeholder="As readers will see it" value="${escapeAttr(ctx.user?.displayName || '')}">
    </label>
    <label class="full">National ID (NIN)
      <input name="nationalId" required maxlength="20" autocomplete="off" placeholder="e.g. CM9000…">
    </label>
    <label>Primary district
      <select name="districtSlug" required>
        <option value="">— Select district —</option>
        ${districts.map((d) => `<option value="${escapeAttr(d.slug)}">${escapeHtml(d.name)}</option>`).join('')}
      </select>
    </label>
    <label>Website (optional)
      <input name="websiteUrl" type="url" placeholder="https://">
    </label>
    <label class="full">Topics / beats you publish on
      <div class="topic-checks">
        ${categories.map((c) => `
          <label class="topic-check"><input type="checkbox" name="topicSlugs" value="${escapeAttr(c.slug)}"> ${escapeHtml(c.name)}</label>
        `).join('') || '<span style="color:var(--grey);font-size:12px;">Categories unavailable — try reloading.</span>'}
      </div>
    </label>
    <label>WhatsApp number
      <input name="whatsappNumber" type="tel" placeholder="+2567…">
    </label>
    <label>Contact phone
      <input name="contactPhone" type="tel" placeholder="+2567…">
    </label>
    <label class="full">Contact email
      <input name="contactEmail" type="email" required value="${escapeAttr(ctx.user?.email || '')}">
    </label>
    <p class="full" style="color:var(--grey);font-size:12px;margin:0;">National ID is stored as a secure hash for uniqueness checks (not shown on your public profile). Provide WhatsApp or phone (or both).</p>
  `;

  const actions = el('div', { class: 'dash-actions full' });
  const submitBtn = el('button', { type: 'submit', text: 'Register as independent journalist' });
  const errorEl = el('p', { class: 'auth-error full' });
  actions.appendChild(submitBtn);
  form.appendChild(actions);
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    const topicSlugs = [...form.querySelectorAll('input[name="topicSlugs"]:checked')].map((n) => n.value);
    try {
      await api.post('/auth/become-independent-journalist', {
        displayName: data.displayName,
        nationalId: data.nationalId,
        districtSlug: data.districtSlug,
        websiteUrl: data.websiteUrl || null,
        whatsappNumber: data.whatsappNumber || null,
        contactPhone: data.contactPhone || null,
        contactEmail: data.contactEmail,
        topicSlugs,
      });
      window.location.reload();
    } catch (err) {
      submitBtn.disabled = false;
      errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong.';
    }
  });

  card.appendChild(form);
  return card;
}

function buildPublisherCard(hasApplication) {
  const card = el('div', { class: 'dash-card onboard-card' });
  card.appendChild(el('h2', { text: 'Publisher (organization)' }));
  card.appendChild(el('p', {
    style: 'margin-bottom:12px;color:var(--grey);font-size:13px;line-height:1.5;',
    text: 'For newspapers, radio/TV, government offices, and district outlets. You must name a contact person and the physical address of the organization. An admin reviews the application before the organization can publish — registration alone is not enough to go live as that outlet.',
  }));

  if (hasApplication) {
    card.appendChild(el('p', {
      style: 'color:var(--grey);font-size:13px;',
      text: 'You already have an active publisher application (see above).',
    }));
    return card;
  }

  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Organization name <input name="name" required maxlength="200" placeholder="Legal or trading name"></label>
    <label>Type
      <select name="orgType">
        <option value="local_publisher">Local publisher</option>
        <option value="newspaper">Newspaper</option>
        <option value="radio">Radio</option>
        <option value="tv">TV</option>
        <option value="government_official">Government office</option>
        <option value="district_outlet">District outlet</option>
      </select>
    </label>
    <label>Website URL <input name="websiteUrl" type="url" placeholder="https://"></label>
    <label class="full">Physical address of organization
      <textarea name="physicalAddress" rows="2" required maxlength="500" placeholder="Building, street, town/city, district"></textarea>
    </label>
    <label class="full">Organization description
      <textarea name="description" rows="2" maxlength="2000" placeholder="What the outlet covers and where it operates"></textarea>
    </label>

    <label class="full" style="margin-top:4px;"><strong style="text-transform:none;letter-spacing:0;font-family:inherit;font-size:13px;color:var(--ink);">Contact person (required for verification)</strong></label>
    <label>Contact person full name <input name="contactPersonName" required maxlength="160"></label>
    <label>Title / role <input name="contactPersonTitle" maxlength="120" placeholder="Editor, station manager…"></label>
    <label>Contact person email <input name="contactPersonEmail" type="email" required></label>
    <label>Contact person phone <input name="contactPersonPhone" type="tel" required placeholder="+2567…"></label>
    <label>Contact person WhatsApp <input name="contactPersonWhatsapp" type="tel" placeholder="+2567…"></label>
    <label>Editorial desk email <input name="editorialContactEmail" type="email" placeholder="Defaults to contact person email"></label>
    <label class="full">Editorial desk phone <input name="editorialContactPhone" type="tel" placeholder="Defaults to contact person phone"></label>
    <p class="full" style="color:var(--grey);font-size:12px;margin:0;">Publishing remains blocked until a newsroom admin approves this organization. Impersonating an outlet may lead to account suspension.</p>
  `;

  const actions = el('div', { class: 'dash-actions full' });
  const submitBtn = el('button', { type: 'submit', text: 'Submit publisher application' });
  const errorEl = el('p', { class: 'auth-error full' });
  actions.appendChild(submitBtn);
  form.appendChild(actions);
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post('/publisher-applications', {
        name: data.name,
        orgType: data.orgType,
        websiteUrl: data.websiteUrl || null,
        physicalAddress: data.physicalAddress,
        description: data.description || null,
        contactPersonName: data.contactPersonName,
        contactPersonTitle: data.contactPersonTitle || null,
        contactPersonEmail: data.contactPersonEmail,
        contactPersonPhone: data.contactPersonPhone,
        contactPersonWhatsapp: data.contactPersonWhatsapp || null,
        editorialContactEmail: data.editorialContactEmail || null,
        editorialContactPhone: data.editorialContactPhone || null,
      });
      window.location.reload();
    } catch (err) {
      submitBtn.disabled = false;
      errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong.';
    }
  });

  card.appendChild(form);
  return card;
}

function escapeAttr(v = '') {
  return String(v || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
