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

  if (applications.length) {
    const app = applications[0];
    wrap.appendChild(el('div', { class: 'dash-card' }, [
      el('h2', { text: 'Your publisher application' }),
      el('p', {}, [
        `${escapeHtml(app.name)} — stage: `,
        el('span', { class: 'badge badge-gold', text: app.stage.replace(/_/g, ' ') }),
      ]),
      el('p', { style: 'margin-top:8px;color:var(--grey);font-size:13px;', text: app.stage === 'rejected'
        ? 'This application was not approved. Contact the newsroom team if you believe this is an error.'
        : 'An admin will review your application. This page will update once the organization is approved. You can start drafting stories in the meantime once a story-authoring role is available.' }),
    ]));
  }

  wrap.appendChild(el('div', { class: 'dash-card' }, [
    el('h2', { text: 'Apply as a publisher' }),
    el('p', { style: 'margin-bottom:12px;color:var(--grey);font-size:13px;', text: 'Register your newspaper, radio, TV station, government office, or district outlet. An admin reviews and approves applications before stories can be published.' }),
    buildApplyForm(),
  ]));

  wrap.appendChild(el('div', { class: 'dash-card' }, [
    el('h2', { text: 'Or continue as an independent journalist' }),
    el('p', { style: 'margin-bottom:12px;color:var(--grey);font-size:13px;', text: 'No organization required. You can start drafting and publishing your own bylined stories immediately.' }),
    (() => {
      const btn = el('button', { text: 'Become an independent journalist' });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api.post('/auth/become-independent-journalist');
          window.location.reload();
        } catch (err) {
          btn.disabled = false;
          alert(err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      return btn;
    })(),
  ]));

  return wrap;
}

function buildApplyForm() {
  const form = el('form', { class: 'dash-form' });
  form.innerHTML = `
    <label class="full">Organization name <input name="name" required></label>
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
    <label class="full">Editorial contact email <input name="editorialContactEmail" type="email"></label>
    <label class="full">Description <textarea name="description" rows="3"></textarea></label>
  `;
  const actions = el('div', { class: 'dash-actions full' });
  const submitBtn = el('button', { type: 'submit', text: 'Submit application' });
  const errorEl = el('p', { class: 'auth-error' });
  actions.appendChild(submitBtn);
  form.appendChild(actions);
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api.post('/publisher-applications', data);
      window.location.reload();
    } catch (err) {
      submitBtn.disabled = false;
      errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong.';
    }
  });

  return form;
}
