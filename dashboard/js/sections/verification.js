import { api, ApiError } from '../api.js';
import { el, formatDate } from '../util.js';

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

  let notifs = [];
  try {
    const data = await api.get('/me/notifications?limit=15');
    notifs = (data.items || []).filter((n) =>
      ['website_verified', 'application_stage', 'application_approved', 'application_rejected', 'feed_domain_verified']
        .includes(n.kind));
  } catch {
    notifs = [];
  }

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Verification', style: 'margin-bottom:16px;' }));
  wrap.appendChild(el('p', {
    style: 'color:var(--grey);font-size:13.5px;margin:0 0 14px;max-width:62ch;',
    text: 'You can publish as soon as your organization lists an active public website. When your website or application is verified, you receive an in-dashboard notification (bell icon, top right). Admins may still review outlets if AI flags unusual activity.',
  }));

  const card = el('div', { class: 'dash-card' });
  if (ctx.orgHasActiveWebsite && !ctx.orgApproved) {
    card.appendChild(el('p', {
      style: 'margin:0 0 12px;padding:10px 12px;background:#eef8f0;border:1px solid #b7e0c0;font-size:13.5px;',
      text: 'Publishing is unlocked via your active website. Keep your site online and accurate; formal verification may follow later.',
    }));
  } else if (!ctx.orgHasActiveWebsite && !ctx.orgApproved) {
    card.appendChild(el('p', {
      style: 'margin:0 0 12px;padding:10px 12px;background:#fdf6e8;border:1px solid #e8d4a8;font-size:13.5px;',
      text: 'Add an active website under Organization Profile to start publishing immediately, or complete verification below.',
    }));
  }
  const status = application?.stage || ctx.organization?.verification_status;

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

  // Website meta-tag verification actions
  if (application && application.id && status !== 'rejected' && status !== 'approved') {
    const webCard = el('div', { class: 'dash-card', style: 'margin-top:16px;' });
    webCard.appendChild(el('h3', { text: 'Verify your website' }));
    webCard.appendChild(el('p', {
      style: 'color:var(--grey);font-size:13px;margin:0 0 12px;',
      text: application.website_verified_at
        ? `Website verified on ${formatDate(application.website_verified_at)}. You should also see a notification in the top bar.`
        : 'Prove you control your homepage, then wait for admin to advance your application. You will be notified when verification succeeds or status changes.',
    }));
    const statusLine = el('p', { style: 'font-size:13px;margin:0 0 10px;' });
    const actions = el('div', { class: 'dash-actions' });
    const startBtn = el('button', { type: 'button', class: 'secondary', text: 'Start website check' });
    const checkBtn = el('button', { type: 'button', text: 'Check website now' });
    actions.appendChild(startBtn);
    actions.appendChild(checkBtn);
    webCard.appendChild(statusLine);
    webCard.appendChild(actions);

    startBtn.addEventListener('click', async () => {
      statusLine.style.color = '';
      statusLine.textContent = 'Starting…';
      try {
        const r = await api.post(`/publisher-applications/${application.id}/website-verification/start`, {});
        statusLine.style.color = 'var(--ink)';
        statusLine.innerHTML = `Add this tag to your homepage <code>&lt;head&gt;</code>:<br><code style="display:block;margin-top:8px;padding:10px;background:var(--paper-dim);word-break:break-all;">&lt;meta name="256newsroom-verification" content="${r.token}"&gt;</code>`;
      } catch (err) {
        statusLine.style.color = 'var(--red)';
        statusLine.textContent = err instanceof ApiError ? err.message : 'Could not start verification.';
      }
    });
    checkBtn.addEventListener('click', async () => {
      statusLine.style.color = '';
      statusLine.textContent = 'Checking your homepage…';
      try {
        const r = await api.post(`/publisher-applications/${application.id}/website-verification/check`, {});
        statusLine.style.color = '#16783c';
        statusLine.textContent = `Website verified at ${formatDate(r.websiteVerifiedAt)}. A notification has been sent to your dashboard.`;
        setTimeout(() => render(container, ctx), 1200);
      } catch (err) {
        statusLine.style.color = 'var(--red)';
        statusLine.textContent = err instanceof ApiError ? err.message : 'Verification failed.';
      }
    });
    wrap.appendChild(card);
    wrap.appendChild(webCard);
  } else {
    wrap.appendChild(card);
  }

  // Related notifications history
  const nCard = el('div', { class: 'dash-card', style: 'margin-top:16px;' });
  nCard.appendChild(el('h3', { text: 'Verification notifications' }));
  nCard.appendChild(el('p', {
    style: 'color:var(--grey);font-size:12.5px;margin:0 0 10px;',
    text: 'Also available anytime from the Notifications bell in the top bar.',
  }));
  if (!notifs.length) {
    nCard.appendChild(el('p', {
      style: 'color:var(--grey);font-size:13px;',
      text: 'No verification notifications yet.',
    }));
  } else {
    notifs.forEach((n) => {
      nCard.appendChild(el('article', {
        style: `border-bottom:1px solid var(--line);padding:10px 0;${n.unread ? 'background:#f8f4ea;padding-left:8px;' : ''}`,
      }, [
        el('strong', { style: 'display:block;font-size:13.5px;', text: n.title }),
        n.body ? el('p', { style: 'margin:4px 0 0;color:var(--grey);font-size:12.5px;', text: n.body }) : null,
        el('time', { style: 'display:block;margin-top:4px;font-size:11px;color:var(--gold);', text: formatDate(n.createdAt) }),
      ].filter(Boolean)));
    });
  }
  wrap.appendChild(nCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
