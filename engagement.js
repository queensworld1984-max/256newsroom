/**
 * 256 Newsroom engagement client — follow publisher, like, upvote, comment.
 * Restricted to logged-in registered journalists/publishers (server-enforced).
 */
(function () {
  const api = async (path, options = {}) => {
    const res = await fetch(`/api/engagement${path}`, {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function loginNext() {
    return `/dashboard/login.html?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
  }

  async function ensureCanEngage() {
    const me = await api('/me');
    if (!me.authenticated) {
      location.href = loginNext();
      return null;
    }
    if (!me.canEngage) {
      alert('Only registered 256 Newsroom journalists and publishers can follow, like, comment, or upvote.');
      return null;
    }
    return me;
  }

  function paintArticleBar(root, data) {
    const pub = data.publisher || {};
    const eng = data.engagement || {};
    const can = data.canEngage;

    const followLabel = data.following ? 'Following' : 'Follow publisher';
    const followBtn = pub.followable
      ? `<button type="button" class="eng-btn eng-follow${data.following ? ' is-on' : ''}" data-action="follow" data-type="${pub.type}" data-id="${pub.id}">${followLabel}</button>`
      : '';

    root.innerHTML = `
      <div class="eng-publisher-row">
        <a class="eng-publisher-link" href="${pub.profileUrl || '#'}">
          <span class="eng-publisher-avatar">${pub.logoUrl ? `<img src="${pub.logoUrl}" alt="">` : (pub.name || 'P').slice(0, 1)}</span>
          <span class="eng-publisher-meta">
            <strong>${escapeHtml(pub.name || 'Publisher')}</strong>
            <small>${escapeHtml(pub.badge || 'Publisher')} · View profile</small>
          </span>
        </a>
        <div class="eng-publisher-actions">
          ${followBtn}
          ${!data.authenticated ? `<a class="eng-btn eng-secondary" href="${loginNext()}">Sign in to engage</a>` : ''}
        </div>
      </div>
      <div class="eng-actions">
        <button type="button" class="eng-chip${eng.liked ? ' is-on' : ''}" data-action="like" ${can ? '' : 'data-need-auth="1"'}>
          ♥ Like <b data-count="likes">${eng.likes || 0}</b>
        </button>
        <button type="button" class="eng-chip${eng.upvoted ? ' is-on' : ''}" data-action="upvote" ${can ? '' : 'data-need-auth="1"'}>
          ▲ Upvote <b data-count="upvotes">${eng.upvotes || 0}</b>
        </button>
        <button type="button" class="eng-chip" data-action="focus-comment" ${can ? '' : 'data-need-auth="1"'}>
          💬 Comment <b data-count="comments">${eng.comments || 0}</b>
        </button>
      </div>
      <div class="eng-comments" id="eng-comments">
        <h3 class="eng-comments-title">Comments from registered journalists &amp; publishers</h3>
        <div class="eng-comment-list" data-comment-list>Loading comments…</div>
        <form class="eng-comment-form" data-comment-form ${can ? '' : 'hidden'}>
          <textarea name="body" rows="3" maxlength="2000" placeholder="Add a professional comment…" required></textarea>
          <button type="submit" class="eng-btn">Post comment</button>
        </form>
        ${can ? '' : `<p class="eng-note">Only registered 256 Newsroom journalists and publishers can comment. <a href="${loginNext()}">Sign in</a></p>`}
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderComments(listEl, items) {
    if (!items.length) {
      listEl.innerHTML = '<p class="eng-empty">No comments yet. Be the first registered journalist or publisher to comment.</p>';
      return;
    }
    listEl.innerHTML = items.map((c) => `
      <article class="eng-comment">
        <header>
          ${c.author?.profileUrl
            ? `<a href="${escapeHtml(c.author.profileUrl)}"><strong>${escapeHtml(c.author.name)}</strong></a>`
            : `<strong>${escapeHtml(c.author?.name || 'Member')}</strong>`}
          <time>${escapeHtml(formatWhen(c.createdAt))}</time>
        </header>
        <p>${escapeHtml(c.body)}</p>
      </article>
    `).join('');
  }

  function formatWhen(v) {
    if (!v) return '';
    try {
      return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
    } catch {
      return String(v);
    }
  }

  function updateCounts(root, eng) {
    const likes = root.querySelector('[data-count="likes"]');
    const ups = root.querySelector('[data-count="upvotes"]');
    const com = root.querySelector('[data-count="comments"]');
    if (likes) likes.textContent = eng.likes || 0;
    if (ups) ups.textContent = eng.upvotes || 0;
    if (com) com.textContent = eng.comments || 0;
    const likeBtn = root.querySelector('[data-action="like"]');
    const upBtn = root.querySelector('[data-action="upvote"]');
    if (likeBtn) likeBtn.classList.toggle('is-on', Boolean(eng.liked));
    if (upBtn) upBtn.classList.toggle('is-on', Boolean(eng.upvoted));
  }

  async function initArticle() {
    const root = document.querySelector('[data-engagement-article-id]');
    if (!root) return;
    const articleId = root.getAttribute('data-engagement-article-id');
    if (!articleId) return;

    try {
      const data = await api(`/articles/${articleId}`);
      paintArticleBar(root, data);

      const comments = await api(`/articles/${articleId}/comments`);
      const listEl = root.querySelector('[data-comment-list]');
      if (listEl) renderComments(listEl, comments.items || []);

      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');

        if (btn.getAttribute('data-need-auth') === '1' || action === 'follow' || action === 'like' || action === 'upvote') {
          if (!(await ensureCanEngage())) return;
        }

        try {
          if (action === 'like') {
            const r = await api(`/articles/${articleId}/like`, { method: 'POST', body: {} });
            updateCounts(root, r.engagement);
          } else if (action === 'upvote') {
            const r = await api(`/articles/${articleId}/upvote`, { method: 'POST', body: {} });
            updateCounts(root, r.engagement);
          } else if (action === 'follow') {
            const type = btn.getAttribute('data-type');
            const id = Number(btn.getAttribute('data-id'));
            const body = type === 'organization' ? { organizationId: id } : { journalistId: id };
            const r = await api('/publishers/follow', { method: 'POST', body });
            btn.textContent = r.following ? 'Following' : 'Follow publisher';
            btn.classList.toggle('is-on', Boolean(r.following));
          } else if (action === 'focus-comment') {
            const form = root.querySelector('[data-comment-form]');
            if (form) {
              form.hidden = false;
              form.querySelector('textarea')?.focus();
            }
          }
        } catch (err) {
          if (err.status === 401) location.href = loginNext();
          else alert(err.message || 'Action failed.');
        }
      });

      const form = root.querySelector('[data-comment-form]');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!(await ensureCanEngage())) return;
          const ta = form.querySelector('textarea');
          const body = (ta?.value || '').trim();
          if (body.length < 2) return;
          try {
            const r = await api(`/articles/${articleId}/comments`, { method: 'POST', body: { body } });
            ta.value = '';
            if (r.engagement) updateCounts(root, r.engagement);
            const list = await api(`/articles/${articleId}/comments`);
            const listEl2 = root.querySelector('[data-comment-list]');
            if (listEl2) renderComments(listEl2, list.items || []);
          } catch (err) {
            alert(err.message || 'Could not post comment.');
          }
        });
      }
    } catch (err) {
      root.innerHTML = `<p class="eng-note">Engagement unavailable (${escapeHtml(err.message || 'error')}).</p>`;
    }
  }

  async function initPublisherPage() {
    const shell = document.querySelector('[data-publisher-org-id]');
    if (!shell) return;
    const orgId = Number(shell.getAttribute('data-publisher-org-id'));
    const slug = shell.getAttribute('data-publisher-slug');
    const followBtn = shell.querySelector('[data-action="follow-org"]');
    if (!followBtn || !orgId) return;

    try {
      const data = await api(`/publishers/${encodeURIComponent(slug)}`);
      if (data.following) {
        followBtn.textContent = 'Following';
        followBtn.classList.add('is-on');
      }
      const countEl = shell.querySelector('[data-follower-count]');
      if (countEl && data.organization) countEl.textContent = data.organization.followerCount;
    } catch { /* ignore */ }

    followBtn.addEventListener('click', async () => {
      if (!(await ensureCanEngage())) return;
      try {
        const r = await api('/publishers/follow', { method: 'POST', body: { organizationId: orgId } });
        followBtn.textContent = r.following ? 'Following' : 'Follow publisher';
        followBtn.classList.toggle('is-on', Boolean(r.following));
        const countEl = shell.querySelector('[data-follower-count]');
        if (countEl) {
          const n = Number(countEl.textContent || 0);
          countEl.textContent = Math.max(0, n + (r.following ? 1 : -1));
        }
      } catch (err) {
        alert(err.message || 'Could not update follow.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initArticle();
    initPublisherPage();
  });
})();
