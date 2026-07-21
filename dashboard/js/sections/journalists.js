import { api, ApiError } from '../api.js';
import { el, escapeHtml } from '../util.js';

export async function render(container, ctx) {
  const [{ items: journalists }, { items: members }] = await Promise.all([
    api.get(`/publishers/${ctx.orgId}/journalists`),
    api.get(`/publishers/${ctx.orgId}/members`),
  ]);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Journalists & Team', style: 'margin-bottom:16px;' }));

  const journalistsCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Journalist bylines' })]);
  if (!journalists.length) {
    journalistsCard.appendChild(el('p', { class: 'dash-empty', text: 'No journalist profiles yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = `<thead><tr><th>Name</th><th>Beat</th><th>Verified</th></tr></thead>`;
    const tbody = el('tbody');
    for (const j of journalists) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: j.name }),
        el('td', { text: j.beat || '—' }),
        el('td', {}, [el('span', { class: `badge ${j.verified ? 'badge-green' : 'badge-grey'}`, text: j.verified ? 'Verified' : 'Unverified' })]),
      ]));
    }
    table.appendChild(tbody);
    journalistsCard.appendChild(table);
  }
  if (ctx.isEditor) {
    const form = el('form', { class: 'dash-form', style: 'margin-top:14px;' });
    form.innerHTML = `
      <label>Name <input name="name" required></label>
      <label>Beat <input name="beat" placeholder="Politics, Sports..."></label>
    `;
    const actions = el('div', { class: 'dash-actions full' });
    const btn = el('button', { type: 'submit', class: 'small', text: 'Add journalist profile' });
    actions.appendChild(btn);
    form.appendChild(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(form).entries());
      try {
        await api.post(`/publishers/${ctx.orgId}/journalists`, raw);
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
    journalistsCard.appendChild(form);
  }
  wrap.appendChild(journalistsCard);

  const membersCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Team members' })]);
  const table2 = el('table', { class: 'dash-table' });
  table2.innerHTML = `<thead><tr><th>Name / email</th><th>Role</th></tr></thead>`;
  const tbody2 = el('tbody');
  for (const m of members) {
    tbody2.appendChild(el('tr', {}, [
      el('td', { text: m.display_name || m.email }),
      el('td', { text: m.role.replace(/_/g, ' ') }),
    ]));
  }
  table2.appendChild(tbody2);
  membersCard.appendChild(table2);

  if (ctx.isEditor) {
    const inviteForm = el('form', { class: 'dash-form', style: 'margin-top:14px;' });
    inviteForm.innerHTML = `
      <label>Email <input name="email" type="email" required></label>
      <label>Role
        <select name="role">
          <option value="publisher_editor">Publisher editor</option>
          <option value="publisher_owner">Publisher owner</option>
          <option value="journalist">Journalist</option>
        </select>
      </label>
    `;
    const actions2 = el('div', { class: 'dash-actions full' });
    const inviteBtn = el('button', { type: 'submit', class: 'small', text: 'Invite member' });
    actions2.appendChild(inviteBtn);
    inviteForm.appendChild(actions2);
    inviteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(inviteForm).entries());
      try {
        await api.post(`/publishers/${ctx.orgId}/members/invite`, raw);
        render(container, ctx);
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    });
    membersCard.appendChild(inviteForm);
  }
  wrap.appendChild(membersCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
