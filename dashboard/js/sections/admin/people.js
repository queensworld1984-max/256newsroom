import { api } from '../../api.js';
import { el, escapeHtml, formatDate } from '../../util.js';

export async function render(container) {
  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: 'People & Journalists' }),
  ]));

  let summary = {};
  try {
    summary = await api.get('/admin/people/summary');
  } catch {
    summary = {};
  }

  const stats = el('div', { class: 'dash-stat-row' });
  const pairs = [
    ['users', 'Accounts'],
    ['journalistsWithAccounts', 'Journalists w/ login'],
    ['independentJournalists', 'Independents'],
    ['openPublisherApplications', 'Open publisher apps'],
    ['pendingReviewStories', 'Stories pending review'],
  ];
  for (const [key, label] of pairs) {
    stats.appendChild(el('div', { class: 'dash-stat' }, [
      el('b', { text: String(summary[key] ?? '—') }),
      el('span', { text: label }),
    ]));
  }
  wrap.appendChild(stats);

  wrap.appendChild(el('p', {
    style: 'margin:0 0 16px;color:var(--grey);font-size:13px;line-height:1.5;',
    text: 'Independent journalists do not appear under Organization → Journalists (that list is only your outlet’s bylines). This admin page shows every registered account and every journalist profile across the newsroom.',
  }));

  const [journalistsRes, usersRes, appsRes] = await Promise.all([
    api.get('/admin/people/journalists'),
    api.get('/admin/people/users'),
    api.get('/admin/publisher-applications').catch(() => ({ items: [] })),
  ]);

  // —— Journalists ——
  const jCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: `Journalist profiles (${journalistsRes.items.length})` }),
  ]);
  if (!journalistsRes.items.length) {
    jCard.appendChild(el('p', { class: 'dash-empty', text: 'No journalist profiles yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = `<thead><tr>
      <th>Name</th><th>Email / account</th><th>Type</th><th>Stories</th><th>Status</th><th>Joined</th>
    </tr></thead>`;
    const tbody = el('tbody');
    for (const j of journalistsRes.items) {
      const type = j.is_independent
        ? 'Independent'
        : (j.organization_name ? `Org: ${j.organization_name}` : 'Directory only');
      const account = j.user_email
        ? `${j.user_email}${j.user_display_name ? ` (${j.user_display_name})` : ''}`
        : '— no login —';
      const tr = el('tr');
      const nameTd = el('td');
      if (j.profile_url) {
        nameTd.appendChild(el('a', {
          href: j.profile_url,
          target: '_blank',
          rel: 'noopener',
          text: j.name,
        }));
      } else {
        nameTd.textContent = j.name;
      }
      tr.appendChild(nameTd);
      tr.appendChild(el('td', { text: account }));
      tr.appendChild(el('td', { text: type }));
      tr.appendChild(el('td', { text: String(j.published_story_count ?? 0) }));
      tr.appendChild(el('td', {}, [
        el('span', {
          class: `badge ${j.verified ? 'badge-green' : (j.user_id ? 'badge-gold' : 'badge-grey')}`,
          text: j.verified ? 'Verified' : (j.user_id ? 'Has account' : 'Seed/directory'),
        }),
      ]));
      tr.appendChild(el('td', { text: formatDate(j.user_created_at || j.created_at) }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    jCard.appendChild(table);
  }
  wrap.appendChild(jCard);

  // —— Users ——
  const uCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: `Registered accounts (${usersRes.items.length})` }),
  ]);
  if (!usersRes.items.length) {
    uCard.appendChild(el('p', { class: 'dash-empty', text: 'No users yet.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = `<thead><tr>
      <th>Email</th><th>Name</th><th>Roles</th><th>Journalist profile</th><th>Created</th><th>Last login</th>
    </tr></thead>`;
    const tbody = el('tbody');
    for (const u of usersRes.items) {
      const roles = Array.isArray(u.roles) ? u.roles.map((r) => r.key).join(', ') : '—';
      const jp = u.journalist_name
        ? `${u.journalist_name}${u.is_independent ? ' (independent)' : ''}`
        : '— not completed —';
      tbody.appendChild(el('tr', {}, [
        el('td', { text: u.email }),
        el('td', { text: u.display_name || '—' }),
        el('td', { text: roles || 'none' }),
        el('td', { text: jp }),
        el('td', { text: formatDate(u.created_at) }),
        el('td', { text: formatDate(u.last_login_at) }),
      ]));
    }
    table.appendChild(tbody);
    uCard.appendChild(table);
  }
  wrap.appendChild(uCard);

  // —— Publisher applications ——
  const apps = appsRes.items || [];
  const aCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: `Publisher applications (${apps.length})` }),
  ]);
  if (!apps.length) {
    aCard.appendChild(el('p', { class: 'dash-empty', text: 'No publisher applications.' }));
  } else {
    const table = el('table', { class: 'dash-table' });
    table.innerHTML = `<thead><tr>
      <th>Organization</th><th>Stage</th><th>Verification</th><th>Submitted</th>
    </tr></thead>`;
    const tbody = el('tbody');
    for (const a of apps) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: a.name || `Org #${a.organization_id}` }),
        el('td', {}, [el('span', { class: 'badge badge-gold', text: String(a.stage || '').replace(/_/g, ' ') })]),
        el('td', { text: String(a.verification_status || '—').replace(/_/g, ' ') }),
        el('td', { text: formatDate(a.submitted_at) }),
      ]));
    }
    table.appendChild(tbody);
    aCard.appendChild(table);
    aCard.appendChild(el('p', {
      style: 'margin-top:10px;color:var(--grey);font-size:12.5px;',
      text: 'Use admin publisher-application APIs to advance/approve stages. Org publishing stays locked until stage is approved.',
    }));
  }
  wrap.appendChild(aCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
