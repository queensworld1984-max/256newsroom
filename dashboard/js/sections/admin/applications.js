import { api, ApiError } from '../../api.js';
import { el, formatDate } from '../../util.js';

export async function render(container) {
  const { items } = await api.get('/admin/publisher-applications');
  const wrap = el('div', { class: 'admin-command' });
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: 'Publisher applications' }),
    el('span', { class: 'badge badge-gold', text: `${items.length} total` }),
  ]));
  wrap.appendChild(el('p', {
    style: 'margin:0 0 16px;color:var(--grey);font-size:13px;line-height:1.5;',
    text: 'Review outlets that applied to publish under an organization name. Advance stages through identity and website checks, then approve so they can publish as that brand.',
  }));

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No applications yet.' })]));
    container.innerHTML = '';
    container.appendChild(wrap);
    return;
  }

  for (const app of items) {
    const card = el('div', { class: 'dash-card admin-app-card' });
    card.appendChild(el('div', { class: 'admin-app-top' }, [
      el('div', {}, [
        el('h3', { text: app.name, style: 'margin:0 0 6px;' }),
        el('p', {
          style: 'margin:0;color:var(--grey);font-size:12.5px;',
          text: `${(app.org_type || '').replace(/_/g, ' ')} · ${app.website_url || 'no website'} · contact ${app.contact_person_name || '—'} ${app.contact_person_email || ''} ${app.contact_person_phone || ''}`,
        }),
        app.physical_address
          ? el('p', { style: 'margin:6px 0 0;color:var(--grey);font-size:12.5px;', text: `Address: ${app.physical_address}` })
          : null,
      ].filter(Boolean)),
      el('div', { class: 'admin-app-badges' }, [
        el('span', { class: 'badge badge-gold', text: String(app.stage || '').replace(/_/g, ' ') }),
        el('span', { class: `badge ${app.verification_status === 'approved' ? 'badge-green' : 'badge-grey'}`, text: String(app.verification_status || '').replace(/_/g, ' ') }),
      ]),
    ]));

    const actions = el('div', { class: 'dash-actions', style: 'margin-top:14px;' });
    if (app.stage !== 'approved' && app.stage !== 'rejected') {
      const advance = el('button', { text: app.stage === 'website_verification' ? 'Approve organization' : 'Advance stage' });
      advance.addEventListener('click', async () => {
        advance.disabled = true;
        try {
          await api.post(`/admin/publisher-applications/${app.id}/advance`, { note: 'Advanced from admin dashboard' });
          render(container);
        } catch (err) {
          advance.disabled = false;
          alert(err instanceof ApiError ? err.message : 'Could not advance.');
        }
      });
      actions.appendChild(advance);

      const reject = el('button', { class: 'danger secondary', text: 'Reject' });
      reject.addEventListener('click', async () => {
        const note = prompt('Rejection note (optional):') ?? '';
        reject.disabled = true;
        try {
          await api.post(`/admin/publisher-applications/${app.id}/reject`, { note });
          render(container);
        } catch (err) {
          reject.disabled = false;
          alert(err instanceof ApiError ? err.message : 'Could not reject.');
        }
      });
      actions.appendChild(reject);
    }
    actions.appendChild(el('span', {
      style: 'align-self:center;color:var(--grey);font-size:12px;',
      text: `Submitted ${formatDate(app.submitted_at)}`,
    }));
    card.appendChild(actions);
    wrap.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}
