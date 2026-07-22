/**
 * 256 Newsroom article engagement — like, agree, and comment on a single article.
 * Follow publisher lives only on the publisher profile page (not mixed with article comments).
 * Actions are restricted to logged-in registered journalists/publishers (server-enforced).
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
      alert('Only registered 256 Newsroom journalists and publishers can like, agree with, or comment on an article.');
      return null;
    }
    return me;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatWhen(v) {
    if (!v) return '';
    try {
      return new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
    } catch {
      return String(v);
    }
  }

  /**
   * Article-only engagement UI. Like / Agree / Comment are scoped to this articleId.
   * Publisher follow is not shown here — use the publisher profile page.
   */
  function paintArticleBar(root, data) {
    const eng = data.engagement || {};
    const can = data.canEngage;
    const articleTitle = data.title ? escapeHtml(data.title) : 'this article';

    root.innerHTML = `
      <div class="eng-article-head">
        <p class="eng-kicker">On this article only</p>
        <h2 class="eng-article-title">Like, agree, or comment</h2>
        <p class="eng-note eng-scope-note">Your reaction applies to this story alone — not the publisher’s profile.</p>
      </div>
      <div class="eng-actions" role="group" aria-label="Reactions for this article">
        <button type="button" class="eng-chip${eng.liked ? ' is-on' : ''}" data-action="like" ${can ? '' : 'data-need-auth="1"'} title="Like this article">
          ♥ Like <b data-count="likes">${eng.likes || 0}</b>
        </button>
        <button type="button" class="eng-chip${eng.upvoted ? ' is-on' : ''}" data-action="agree" ${can ? '' : 'data-need-auth="1"'} title="Agree with this article">
          ✓ Agree <b data-count="agrees">${eng.upvotes || 0}</b>
        </button>
        <button type="button" class="eng-chip" data-action="focus-comment" ${can ? '' : 'data-need-auth="1"'} title="Comment on this article">
          💬 Comment <b data-count="comments">${eng.comments || 0}</b>
        </button>
        ${!data.authenticated ? `<a class="eng-btn eng-secondary" href="${loginNext()}">Sign in to react</a>` : ''}
      </div>
      <div class="eng-comments" id="eng-comments">
        <h3 class="eng-comments-title">Comments on this article</h3>
        <p class="eng-note">Each comment is stored against this story only.</p>
        <div class="eng-comment-list" data-comment-list>Loading comments…</div>
        <form class="eng-comment-form" data-comment-form ${can ? '' : 'hidden'}>
          <label class="eng-sr-only" for="eng-comment-body">Comment on ${articleTitle}</label>
          <textarea id="eng-comment-body" name="body" rows="3" maxlength="2000" placeholder="Write a comment on this article…" required></textarea>
          <button type="submit" class="eng-btn">Post comment on this article</button>
        </form>
        ${can ? '' : `<p class="eng-note">Only registered 256 Newsroom journalists and publishers can comment on articles. <a href="${loginNext()}">Sign in</a></p>`}
      </div>
    `;
  }

  function renderComments(listEl, items) {
    if (!items.length) {
      listEl.innerHTML = '<p class="eng-empty">No comments on this article yet. Be the first to comment here.</p>';
      return;
    }
    listEl.innerHTML = items.map((c) => `
      <article class="eng-comment" data-comment-id="${c.id}">
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

  function updateCounts(root, eng) {
    const likes = root.querySelector('[data-count="likes"]');
    const agrees = root.querySelector('[data-count="agrees"]');
    const com = root.querySelector('[data-count="comments"]');
    if (likes) likes.textContent = eng.likes || 0;
    if (agrees) agrees.textContent = eng.upvotes || 0;
    if (com) com.textContent = eng.comments || 0;
    const likeBtn = root.querySelector('[data-action="like"]');
    const agreeBtn = root.querySelector('[data-action="agree"]');
    if (likeBtn) likeBtn.classList.toggle('is-on', Boolean(eng.liked));
    if (agreeBtn) agreeBtn.classList.toggle('is-on', Boolean(eng.upvoted));
  }

  async function initArticle() {
    const root = document.querySelector('[data-engagement-article-id]');
    if (!root) return;
    const articleId = root.getAttribute('data-engagement-article-id');
    if (!articleId) return;

    // Guard: never mount article reactions on a publisher profile shell.
    if (document.querySelector('[data-publisher-org-id]') && !root.closest('article')) {
      root.innerHTML = '';
      return;
    }

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

        try {
          if (action === 'like') {
            if (!(await ensureCanEngage())) return;
            const r = await api(`/articles/${articleId}/like`, { method: 'POST', body: {} });
            updateCounts(root, r.engagement);
          } else if (action === 'agree') {
            if (!(await ensureCanEngage())) return;
            // Server endpoint remains /upvote; UI label is "Agree".
            const r = await api(`/articles/${articleId}/upvote`, { method: 'POST', body: {} });
            updateCounts(root, r.engagement);
          } else if (action === 'focus-comment') {
            if (btn.getAttribute('data-need-auth') === '1' && !(await ensureCanEngage())) return;
            const form = root.querySelector('[data-comment-form]');
            if (form) {
              form.hidden = false;
              form.querySelector('textarea')?.focus();
              form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            if (err.status === 401) location.href = loginNext();
            else alert(err.message || 'Could not post comment on this article.');
          }
        });
      }
    } catch (err) {
      root.innerHTML = `<p class="eng-note">Article engagement unavailable (${escapeHtml(err.message || 'error')}).</p>`;
    }
  }

  /** Publisher profile: follow only — never like/agree/comment on the profile. */
  async function initPublisherPage() {
    const shell = document.querySelector('[data-publisher-org-id]');
    if (!shell) return;

    // Strip any accidental article engagement mounts on the profile page.
    shell.querySelectorAll('[data-engagement-article-id]').forEach((node) => {
      node.remove();
    });

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
