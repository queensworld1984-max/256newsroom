import { api } from '../api.js';
import { el } from '../util.js';

const STAGES = [
  ['application', 'Application submitted'],
  ['identity_review', 'Identity review'],
  ['website_verification', 'Website verification'],
  ['approved', 'Approved'],
];

export async function render(container, ctx) {
  let application = null;
  try {
    const { items } = await api.get('/publisher-applications/mine');
    application = items.find((a) => String(a.organization_id) === String(ctx.orgId)) || null;
  } catch {
    application = null;
  }

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Verification', style: 'margin-bottom:16px;' }));

  const card = el('div', { class: 'dash-card' });
  const status = application?.stage || ctx.organization.verification_status;

  if (status === 'rejected') {
    card.appendChild(el('p', {}, [el('span', { class: 'badge badge-red', text: 'Rejected' })]));
    if (application?.review_notes) card.appendChild(el('p', { style: 'margin-top:10px;', text: application.review_notes }));
  } else {
    const steps = el('div', { style: 'display:grid;gap:10px;' });
    const currentIndex = STAGES.findIndex(([key]) => key === status);
    STAGES.forEach(([key, label], i) => {
      const done = currentIndex >= 0 && i <= currentIndex;
      steps.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
        el('span', { class: `badge ${done ? 'badge-green' : 'badge-grey'}`, text: done ? '✓' : String(i + 1) }),
        el('span', { text: label }),
      ]));
    });
    card.appendChild(steps);
  }

  wrap.appendChild(card);
  container.innerHTML = '';
  container.appendChild(wrap);
}
