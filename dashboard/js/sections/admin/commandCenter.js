import { api, ApiError } from '../../api.js';
import { el, formatDate } from '../../util.js';

function rolesText(roles) {
  if (Array.isArray(roles)) return roles.join(', ') || 'none';
  if (roles == null) return 'none';
  return String(roles);
}

export async function render(container) {
  // Paint a shell immediately so the page never sits on a bare "Loading..." forever.
  container.innerHTML = '';
  const wrap = el('div', { class: 'admin-command' });
  wrap.appendChild(el('div', { class: 'admin-hero' }, [
    el('div', {}, [
      el('p', { class: 'admin-kicker', text: '256 Newsroom · Control room' }),
      el('h1', { text: 'Platform operations' }),
      el('p', {
        class: 'admin-lede',
        text: 'Oversee every account, independent journalist, publisher application, and authored story. This is the admin surface — not a single outlet publisher workspace.',
      }),
    ]),
    el('div', { class: 'admin-hero-actions' }, [
      el('a', { class: 'admin-pill', href: '#/admin/people', text: 'People directory' }),
      el('a', { class: 'admin-pill', href: '#/admin/applications', text: 'Publisher apps' }),
      el('a', { class: 'admin-pill', href: '#/admin/stories', text: 'Story queue' }),
      el('a', { class: 'admin-pill secondary', href: '#/admin/ecosystem/overview', text: 'Ecosystem automation' }),
    ]),
  ]));
  const status = el('p', { class: 'dash-empty', text: 'Loading control-room metrics…' });
  wrap.appendChild(status);
  container.appendChild(wrap);

  let data;
  try {
    data = await api.get('/admin/people/summary');
  } catch (err) {
    status.className = 'dash-toast error';
    status.textContent = err instanceof ApiError
      ? `Could not load admin metrics: ${err.message}`
      : 'Could not load admin metrics. Check that you are logged in as newsroom admin.';
    return;
  }

  status.remove();

  const kpi = el('div', { class: 'admin-kpi-grid' });
  const cards = [
    { n: data.users, l: 'Registered accounts', href: '#/admin/people' },
    { n: data.journalistsWithAccounts, l: 'Journalists with login', href: '#/admin/people' },
    { n: data.independentJournalists, l: 'Independent journalists', href: '#/admin/people' },
    { n: data.openPublisherApplications, l: 'Open publisher apps', href: '#/admin/applications', alert: data.openPublisherApplications > 0 },
    { n: data.pendingReviewStories, l: 'Draft / pending stories', href: '#/admin/stories', alert: data.pendingReviewStories > 0 },
    { n: data.publishedToday, l: 'Published today', href: '#/admin/stories' },
    { n: data.publishedTotal, l: 'Published total', href: '#/admin/stories' },
    { n: data.orgsUnverified, l: 'Unverified organizations', href: '#/admin/applications', alert: data.orgsUnverified > 0 },
  ];
  for (const c of cards) {
    const card = el('a', { class: `admin-kpi${c.alert ? ' alert' : ''}`, href: c.href });
    card.appendChild(el('b', { text: String(c.n ?? 0) }));
    card.appendChild(el('span', { text: c.l }));
    kpi.appendChild(card);
  }
  wrap.appendChild(kpi);

  const grid = el('div', { class: 'admin-split' });

  const usersCard = el('div', { class: 'dash-card admin-panel' }, [
    el('div', { class: 'admin-panel-head' }, [
      el('h3', { text: 'Newest accounts' }),
      el('a', { href: '#/admin/people', text: 'View all →' }),
    ]),
  ]);
  if (!(data.recentUsers || []).length) {
    usersCard.appendChild(el('p', { class: 'dash-empty', text: 'No accounts yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Email</th><th>Name</th><th>Roles</th><th>Joined</th></tr></thead>';
    const tbody = el('tbody');
    for (const u of data.recentUsers) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: u.email }),
        el('td', { text: u.display_name || '—' }),
        el('td', { text: rolesText(u.roles) }),
        el('td', { text: formatDate(u.created_at) }),
      ]));
    }
    table.appendChild(tbody);
    usersCard.appendChild(table);
  }
  grid.appendChild(usersCard);

  const jCard = el('div', { class: 'dash-card admin-panel' }, [
    el('div', { class: 'admin-panel-head' }, [
      el('h3', { text: 'Newest journalist profiles' }),
      el('a', { href: '#/admin/people', text: 'View all →' }),
    ]),
  ]);
  if (!(data.recentJournalists || []).length) {
    jCard.appendChild(el('p', { class: 'dash-empty', text: 'No account-linked journalists yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Created</th></tr></thead>';
    const tbody = el('tbody');
    for (const j of data.recentJournalists) {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [el('a', { href: `/journalists/profile.html?slug=${encodeURIComponent(j.slug)}`, target: '_blank', text: j.name })]),
        el('td', { text: j.email || '—' }),
        el('td', {}, [el('span', { class: `badge ${j.is_independent ? 'badge-green' : 'badge-grey'}`, text: j.is_independent ? 'Independent' : 'Org' })]),
        el('td', { text: formatDate(j.created_at) }),
      ]));
    }
    table.appendChild(tbody);
    jCard.appendChild(table);
  }
  grid.appendChild(jCard);
  wrap.appendChild(grid);

  const queue = el('div', { class: 'dash-card admin-panel' }, [
    el('div', { class: 'admin-panel-head' }, [
      el('h3', { text: 'Author story queue (needs attention)' }),
      el('a', { href: '#/admin/stories', text: 'Full queue →' }),
    ]),
  ]);
  const pending = data.recentPendingStories || [];
  if (!pending.length) {
    queue.appendChild(el('p', { class: 'dash-empty', text: 'No draft or pending-review authored stories. Queue is clear.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = '<thead><tr><th>Title</th><th>Author</th><th>Org</th><th>Status</th><th>Updated</th><th></th></tr></thead>';
    const tbody = el('tbody');
    for (const s of pending) {
      const actions = el('td');
      const row = el('div', { class: 'dash-actions', style: 'margin:0;gap:6px;' });
      const pubBtn = el('button', { class: 'small', text: 'Publish live' });
      pubBtn.addEventListener('click', async () => {
        pubBtn.disabled = true;
        try {
          await api.post(`/admin/people/stories/${s.id}/publish`, {});
          render(container);
        } catch (err) {
          pubBtn.disabled = false;
          alert(err instanceof ApiError ? err.message : 'Publish failed.');
        }
      });
      row.appendChild(pubBtn);
      const delBtn = el('button', { class: 'small danger', text: 'Delete' });
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Permanently delete #${s.id}?\n${s.title || ''}`)) return;
        if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
        delBtn.disabled = true;
        try {
          await api.del(`/admin/people/stories/${s.id}`);
          render(container);
        } catch (err) {
          delBtn.disabled = false;
          alert(err instanceof ApiError ? err.message : 'Delete failed.');
        }
      });
      row.appendChild(delBtn);
      actions.appendChild(row);
      tbody.appendChild(el('tr', {}, [
        el('td', { text: s.title || '(untitled)' }),
        el('td', { text: s.author_name || s.author_email || '—' }),
        el('td', { text: s.org_name ? `${s.org_name} (${s.verification_status || '—'})` : 'Independent' }),
        el('td', {}, [el('span', { class: 'badge badge-gold', text: String(s.status).replace(/_/g, ' ') })]),
        el('td', { text: formatDate(s.updated_at) }),
        actions,
      ]));
    }
    table.appendChild(tbody);
    queue.appendChild(table);
  }
  wrap.appendChild(queue);

  wrap.appendChild(el('div', { class: 'dash-card admin-note' }, [
    el('h3', { text: 'About this dashboard' }),
    el('p', {
      style: 'color:var(--grey);font-size:13.5px;line-height:1.55;margin:0;',
      text: 'If you also own a publisher organization, that workspace is under "My outlet" in the sidebar. Publishing as an unverified outlet stays locked until you approve the application. Independent journalists and admin force-publish are separate paths.',
    }),
  ]));
}
