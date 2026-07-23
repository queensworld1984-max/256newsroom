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
  wrap.appendChild(el('p', {
    style: 'color:var(--grey);font-size:13.5px;margin:0 0 14px;max-width:62ch;',
    text: 'You can publish as soon as your organization lists an active public website. Formal verification is optional for posting — admins may still review outlets if AI flags unusual activity. Verified status adds a public trust badge.',
  }));

  const card = el('div', { class: 'dash-card' });
  if (ctx.orgHasActiveWebsite && !ctx.orgApproved) {
    card.appendChild(el('p', {
      style: 'margin:0 0 12px;padding:10px 12px;background:#eef8f0;border:1px solid #b7e0c0;font-size:13.5px;',
      text: 'Publishing is unlocked via your active website. Keep your site online and accurate; verification may follow later.',
    }));
  } else if (!ctx.orgHasActiveWebsite && !ctx.orgApproved) {
    card.appendChild(el('p', {
      style: 'margin:0 0 12px;padding:10px 12px;background:#fdf6e8;border:1px solid #e8d4a8;font-size:13.5px;',
      text: 'Add an active website under Organization Profile to start publishing immediately, or complete verification below.',
    }));
  }
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
