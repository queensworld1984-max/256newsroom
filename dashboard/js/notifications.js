import { api } from './api.js';
import { el, escapeHtml, formatDate } from './util.js';

let panelOpen = false;
let pollTimer = null;

function formatRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(iso);
}

export function mountNotifications(anchorEl) {
  // Prefer the topbar user container so we don't wipe the name span on re-render.
  const host = anchorEl?.closest?.('.dash-topbar-user')
    || document.querySelector('.dash-topbar-user')
    || anchorEl;
  if (!host || host.dataset.notifMounted === '1') return;
  host.dataset.notifMounted = '1';

  const wrap = el('div', { class: 'notif-wrap' });
  const btn = el('button', {
    type: 'button',
    class: 'secondary small notif-bell',
    text: 'Notifications',
    'aria-label': 'Notifications',
  });
  const badge = el('span', { class: 'notif-badge', hidden: true, text: '0' });
  btn.appendChild(badge);

  const panel = el('div', { class: 'notif-panel', hidden: true });
  panel.innerHTML = `
    <div class="notif-panel-head">
      <strong>Notifications</strong>
      <button type="button" class="secondary small" data-mark-all>Mark all read</button>
    </div>
    <div class="notif-list" data-list><p class="dash-empty">Loading…</p></div>
  `;

  wrap.appendChild(btn);
  wrap.appendChild(panel);
  const logout = document.getElementById('dash-logout');
  if (logout && logout.parentElement === host) {
    host.insertBefore(wrap, logout);
  } else {
    host.appendChild(wrap);
  }

  async function refreshBadge() {
    try {
      const { unreadCount } = await api.get('/me/notifications/unread-count');
      const n = Number(unreadCount) || 0;
      if (n > 0) {
        badge.hidden = false;
        badge.textContent = n > 99 ? '99+' : String(n);
      } else {
        badge.hidden = true;
      }
    } catch {
      badge.hidden = true;
    }
  }

  async function loadList() {
    const list = panel.querySelector('[data-list]');
    try {
      const data = await api.get('/me/notifications?limit=30');
      const items = data.items || [];
      if (!items.length) {
        list.innerHTML = '<p class="dash-empty">No notifications yet. You will see website verification, application updates, and more here.</p>';
        return;
      }
      list.innerHTML = items.map((n) => `
        <article class="notif-item ${n.unread ? 'is-unread' : ''}" data-id="${n.id}" data-href="${escapeHtml(n.href || '')}">
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          ${n.body ? `<p class="notif-item-body">${escapeHtml(n.body)}</p>` : ''}
          <time class="notif-item-time">${escapeHtml(formatRelative(n.createdAt))}</time>
        </article>
      `).join('');
    } catch {
      list.innerHTML = '<p class="dash-empty">Could not load notifications.</p>';
    }
  }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    panel.hidden = !panelOpen;
    if (panelOpen) await loadList();
  });

  panel.addEventListener('click', async (e) => {
    e.stopPropagation();
    const markAll = e.target.closest('[data-mark-all]');
    if (markAll) {
      try {
        await api.post('/me/notifications/read-all', {});
        await refreshBadge();
        await loadList();
      } catch { /* ignore */ }
      return;
    }
    const item = e.target.closest('.notif-item');
    if (!item) return;
    const id = item.getAttribute('data-id');
    const href = item.getAttribute('data-href');
    try {
      await api.post(`/me/notifications/${id}/read`, {});
    } catch { /* ignore */ }
    await refreshBadge();
    item.classList.remove('is-unread');
    if (href) {
      if (href.includes('#')) {
        window.location.hash = href.slice(href.indexOf('#'));
      } else if (href.startsWith('/dashboard')) {
        window.location.href = href;
      } else if (href.startsWith('/')) {
        window.location.href = href;
      }
      panelOpen = false;
      panel.hidden = true;
    }
  });

  document.addEventListener('click', () => {
    if (!panelOpen) return;
    panelOpen = false;
    panel.hidden = true;
  });

  refreshBadge();
  pollTimer = setInterval(refreshBadge, 45000);
  return () => {
    if (pollTimer) clearInterval(pollTimer);
  };
}
