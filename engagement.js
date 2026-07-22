/**
 * 256 Newsroom article debate — like, agree/disagree with reasons, comments.
 * Agree and Disagree both require a written explanation (per article only).
 */
(function () {
  const REASON_MIN = 15;

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
      alert('Only registered 256 Newsroom journalists and publishers can debate or comment on an article.');
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

  function paintArticleBar(root, data) {
    const eng = data.engagement || {};
    const can = data.canEngage;
    const myStance = eng.myStance || null;
    const myReason = eng.myReason || '';

    root.innerHTML = `
      <div class="eng-article-head">
        <p class="eng-kicker">Debate on this article</p>
        <h2 class="eng-article-title">Like, agree, disagree — then explain why</h2>
        <p class="eng-note eng-scope-note">Agree and Disagree require a short reason. All positions stay on this story only.</p>
      </div>
      <div class="eng-actions" role="group" aria-label="Reactions for this article">
        <button type="button" class="eng-chip eng-chip-like${eng.liked ? ' is-on' : ''}" data-action="like" ${can ? '' : 'data-need-auth="1"'} title="Like this article">
          ♥ Like <b data-count="likes">${eng.likes || 0}</b>
        </button>
        <button type="button" class="eng-chip eng-chip-agree${myStance === 'agree' ? ' is-on' : ''}" data-action="open-stance" data-stance="agree" ${can ? '' : 'data-need-auth="1"'} title="Agree and explain why">
          ✓ Agree <b data-count="agrees">${eng.agrees || eng.upvotes || 0}</b>
        </button>
        <button type="button" class="eng-chip eng-chip-disagree${myStance === 'disagree' ? ' is-on' : ''}" data-action="open-stance" data-stance="disagree" ${can ? '' : 'data-need-auth="1"'} title="Disagree and explain why">
          ✗ Disagree <b data-count="disagrees">${eng.disagrees || 0}</b>
        </button>
        <button type="button" class="eng-chip eng-chip-comment" data-action="focus-comment" ${can ? '' : 'data-need-auth="1"'} title="Comment on this article">
          💬 Comment <b data-count="comments">${eng.comments || 0}</b>
        </button>
        ${!data.authenticated ? `<a class="eng-btn eng-secondary" href="${loginNext()}">Sign in to debate</a>` : ''}
      </div>

      <form class="eng-stance-form" data-stance-form hidden>
        <p class="eng-stance-prompt" data-stance-prompt>Why do you agree?</p>
        <textarea name="reason" rows="4" maxlength="2000" minlength="${REASON_MIN}"
          placeholder="Write at least ${REASON_MIN} characters explaining your position…" required></textarea>
        <div class="eng-stance-actions">
          <button type="submit" class="eng-btn" data-stance-submit>Post my position</button>
          <button type="button" class="eng-btn eng-secondary" data-action="cancel-stance">Cancel</button>
          ${myStance ? `<button type="button" class="eng-btn eng-secondary" data-action="withdraw-stance">Withdraw my position</button>` : ''}
        </div>
        <p class="eng-note eng-stance-status" data-stance-status></p>
      </form>

      <div class="eng-debate" id="eng-debate">
        <h3 class="eng-comments-title">Debate board</h3>
        <p class="eng-note">Arguments for and against this article. Each entry includes the writer’s reason.</p>
        <div class="eng-debate-grid">
          <section class="eng-debate-col eng-debate-agree" aria-label="Agree arguments">
            <h4>✓ Agree <span data-count="agrees-list">${eng.agrees || 0}</span></h4>
            <div data-debate-agree>Loading…</div>
          </section>
          <section class="eng-debate-col eng-debate-disagree" aria-label="Disagree arguments">
            <h4>✗ Disagree <span data-count="disagrees-list">${eng.disagrees || 0}</span></h4>
            <div data-debate-disagree>Loading…</div>
          </section>
        </div>
      </div>

      <div class="fb-comments" id="eng-comments" data-comments-root>
        <h3 class="fb-comments-title">Comments <span class="fb-comments-count" data-count="comments">${eng.comments || 0}</span></h3>
        <div class="fb-composer" data-comment-composer ${can ? '' : 'hidden'}>
          <div class="fb-avatar fb-avatar-me" aria-hidden="true">You</div>
          <form class="fb-composer-form" data-comment-form>
            <textarea name="body" rows="1" maxlength="2000" placeholder="Write a comment…" required></textarea>
            <button type="submit" class="fb-post-btn">Post</button>
          </form>
        </div>
        ${can ? '' : `<p class="eng-note">Only registered journalists and publishers can comment. <a href="${loginNext()}">Sign in</a></p>`}
        <div class="fb-comment-list" data-comment-list>Loading comments…</div>
      </div>
    `;

    // Prefill reason if user already has a stance
    if (myReason) {
      const ta = root.querySelector('[data-stance-form] textarea');
      if (ta) ta.value = myReason;
    }
  }

  function renderDebateColumn(el, items, emptyLabel) {
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<p class="eng-empty">${escapeHtml(emptyLabel)}</p>`;
      return;
    }
    el.innerHTML = items.map((s) => `
      <article class="eng-stance eng-stance-${escapeHtml(s.stance)}" data-stance-id="${s.id}">
        <header>
          ${s.author?.profileUrl
            ? `<a href="${escapeHtml(s.author.profileUrl)}"><strong>${escapeHtml(s.author.name)}</strong></a>`
            : `<strong>${escapeHtml(s.author?.name || 'Member')}</strong>`}
          <time>${escapeHtml(formatWhen(s.updatedAt || s.createdAt))}</time>
        </header>
        <p class="eng-stance-reason">${escapeHtml(s.reason)}</p>
      </article>
    `).join('');
  }

  function avatarHtml(author) {
    if (author?.avatarUrl) {
      return `<div class="fb-avatar"><img src="${escapeHtml(author.avatarUrl)}" alt=""></div>`;
    }
    const initial = escapeHtml(author?.avatarInitial || (author?.name || 'M').slice(0, 1).toUpperCase());
    return `<div class="fb-avatar" aria-hidden="true">${initial}</div>`;
  }

  function commentCardHtml(c, isReply = false) {
    const name = escapeHtml(c.author?.name || 'Member');
    const nameHtml = c.author?.profileUrl
      ? `<a class="fb-name" href="${escapeHtml(c.author.profileUrl)}">${name}</a>`
      : `<span class="fb-name">${name}</span>`;
    const edited = c.edited ? ' · <span class="fb-edited">Edited</span>' : '';
    const ownActions = c.isOwn
      ? `<button type="button" class="fb-action" data-c-action="edit" data-comment-id="${c.id}">Edit</button>
         <button type="button" class="fb-action" data-c-action="delete" data-comment-id="${c.id}">Delete</button>`
      : '';
    const replies = (!isReply && Array.isArray(c.replies) && c.replies.length)
      ? `<div class="fb-replies">${c.replies.map((r) => commentCardHtml(r, true)).join('')}</div>`
      : '';

    return `
      <div class="fb-comment ${isReply ? 'is-reply' : ''}" data-comment-id="${c.id}" data-parent-id="${c.parentId || ''}">
        ${avatarHtml(c.author)}
        <div class="fb-comment-main">
          <div class="fb-bubble">
            ${nameHtml}
            <div class="fb-body" data-comment-body>${escapeHtml(c.body)}</div>
          </div>
          <div class="fb-meta">
            <time class="fb-time">${escapeHtml(formatWhen(c.createdAt))}</time>${edited}
            <button type="button" class="fb-action" data-c-action="reply" data-comment-id="${c.id}" data-reply-to="${name}">Reply</button>
            ${ownActions}
          </div>
          <div class="fb-inline-form" data-inline-form hidden></div>
          ${replies}
        </div>
      </div>`;
  }

  function renderComments(listEl, items) {
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = '<p class="fb-empty">No comments yet. Be the first to comment.</p>';
      return;
    }
    listEl.innerHTML = items.map((c) => commentCardHtml(c, false)).join('');
  }

  async function refreshComments(root, articleId) {
    const list = await api(`/articles/${articleId}/comments`);
    renderComments(root.querySelector('[data-comment-list]'), list.items || []);
    if (list.count != null) {
      root.querySelectorAll('[data-count="comments"]').forEach((n) => {
        n.textContent = list.count;
      });
    }
    return list;
  }

  function showInlineForm(container, { placeholder, initial = '', submitLabel, onSubmit, onCancel }) {
    container.hidden = false;
    container.innerHTML = `
      <form class="fb-inline-compose">
        <textarea rows="2" maxlength="2000" placeholder="${escapeHtml(placeholder)}" required></textarea>
        <div class="fb-inline-actions">
          <button type="submit" class="fb-post-btn">${escapeHtml(submitLabel)}</button>
          <button type="button" class="fb-cancel-btn" data-cancel>Cancel</button>
        </div>
      </form>`;
    const form = container.querySelector('form');
    const ta = form.querySelector('textarea');
    ta.value = initial;
    ta.focus();
    form.querySelector('[data-cancel]').addEventListener('click', () => {
      container.hidden = true;
      container.innerHTML = '';
      if (onCancel) onCancel();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = (ta.value || '').trim();
      if (!body) return;
      await onSubmit(body);
      container.hidden = true;
      container.innerHTML = '';
    });
  }

  function updateCounts(root, eng) {
    const set = (sel, val) => {
      root.querySelectorAll(sel).forEach((n) => { n.textContent = val; });
    };
    set('[data-count="likes"]', eng.likes || 0);
    set('[data-count="agrees"]', eng.agrees || eng.upvotes || 0);
    set('[data-count="agrees-list"]', eng.agrees || eng.upvotes || 0);
    set('[data-count="disagrees"]', eng.disagrees || 0);
    set('[data-count="disagrees-list"]', eng.disagrees || 0);
    set('[data-count="comments"]', eng.comments || 0);

    const likeBtn = root.querySelector('[data-action="like"]');
    if (likeBtn) likeBtn.classList.toggle('is-on', Boolean(eng.liked));
    const agreeBtn = root.querySelector('[data-stance="agree"]');
    const disagreeBtn = root.querySelector('[data-stance="disagree"]');
    if (agreeBtn) agreeBtn.classList.toggle('is-on', eng.myStance === 'agree');
    if (disagreeBtn) disagreeBtn.classList.toggle('is-on', eng.myStance === 'disagree');
  }

  function openStanceForm(root, stance, eng) {
    const form = root.querySelector('[data-stance-form]');
    if (!form) return;
    form.hidden = false;
    form.dataset.stance = stance;
    const prompt = form.querySelector('[data-stance-prompt]');
    const submit = form.querySelector('[data-stance-submit]');
    const ta = form.querySelector('textarea');
    const status = form.querySelector('[data-stance-status]');
    if (prompt) {
      prompt.textContent = stance === 'disagree'
        ? 'Why do you disagree with this article?'
        : 'Why do you agree with this article?';
      prompt.className = `eng-stance-prompt eng-stance-prompt-${stance}`;
    }
    if (submit) {
      submit.textContent = stance === 'disagree' ? 'Post disagree + reason' : 'Post agree + reason';
    }
    if (ta) {
      if (eng?.myStance === stance && eng?.myReason) ta.value = eng.myReason;
      else if (eng?.myStance && eng?.myStance !== stance) {
        // Switching side — clear so they write a new reason
        ta.value = '';
      }
      ta.focus();
    }
    if (status) status.textContent = `Your reason must be at least ${REASON_MIN} characters.`;
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function refreshDebate(root, articleId) {
    const debate = await api(`/articles/${articleId}/debate`);
    renderDebateColumn(
      root.querySelector('[data-debate-agree]'),
      debate.agrees || [],
      'No agree arguments yet. Be the first to agree and explain why.',
    );
    renderDebateColumn(
      root.querySelector('[data-debate-disagree]'),
      debate.disagrees || [],
      'No disagree arguments yet. Be the first to disagree and explain why.',
    );
    if (debate.engagement) updateCounts(root, debate.engagement);
    return debate;
  }

  async function initArticle() {
    const root = document.querySelector('[data-engagement-article-id]');
    if (!root) return;
    const articleId = root.getAttribute('data-engagement-article-id');
    if (!articleId) return;

    if (document.querySelector('[data-publisher-org-id]') && !root.closest('article')) {
      root.innerHTML = '';
      return;
    }

    let engState = {};

    try {
      const data = await api(`/articles/${articleId}`);
      engState = data.engagement || {};
      paintArticleBar(root, data);

      await refreshDebate(root, articleId);

      await refreshComments(root, articleId);

      root.addEventListener('click', async (e) => {
        // Facebook-style comment actions (reply / edit / delete)
        const cBtn = e.target.closest('[data-c-action]');
        if (cBtn && root.contains(cBtn)) {
          const cAction = cBtn.getAttribute('data-c-action');
          const commentId = Number(cBtn.getAttribute('data-comment-id'));
          const card = root.querySelector(`.fb-comment[data-comment-id="${commentId}"]`);
          try {
            if (cAction === 'reply') {
              if (!(await ensureCanEngage())) return;
              const formHost = card?.querySelector('[data-inline-form]');
              if (!formHost) return;
              const replyTo = cBtn.getAttribute('data-reply-to') || '';
              showInlineForm(formHost, {
                placeholder: replyTo ? `Reply to ${replyTo}…` : 'Write a reply…',
                submitLabel: 'Reply',
                onSubmit: async (body) => {
                  const r = await api(`/articles/${articleId}/comments`, {
                    method: 'POST',
                    body: { body, parentId: commentId },
                  });
                  if (r.engagement) {
                    engState = r.engagement;
                    updateCounts(root, engState);
                  }
                  await refreshComments(root, articleId);
                },
              });
            } else if (cAction === 'edit') {
              if (!(await ensureCanEngage())) return;
              const formHost = card?.querySelector('[data-inline-form]');
              const current = card?.querySelector('[data-comment-body]')?.textContent || '';
              if (!formHost) return;
              showInlineForm(formHost, {
                placeholder: 'Edit your comment…',
                initial: current,
                submitLabel: 'Save',
                onSubmit: async (body) => {
                  const r = await api(`/articles/${articleId}/comments/${commentId}`, {
                    method: 'PATCH',
                    body: { body },
                  });
                  if (r.engagement) {
                    engState = r.engagement;
                    updateCounts(root, engState);
                  }
                  await refreshComments(root, articleId);
                },
              });
            } else if (cAction === 'delete') {
              if (!(await ensureCanEngage())) return;
              if (!confirm('Delete this comment?')) return;
              const r = await api(`/articles/${articleId}/comments/${commentId}`, { method: 'DELETE' });
              if (r.engagement) {
                engState = r.engagement;
                updateCounts(root, engState);
              }
              await refreshComments(root, articleId);
            }
          } catch (err) {
            if (err.status === 401) location.href = loginNext();
            else alert(err.message || 'Comment action failed.');
          }
          return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');

        try {
          if (action === 'like') {
            if (!(await ensureCanEngage())) return;
            const r = await api(`/articles/${articleId}/like`, { method: 'POST', body: {} });
            engState = r.engagement || engState;
            updateCounts(root, engState);
          } else if (action === 'open-stance') {
            if (!(await ensureCanEngage())) return;
            const stance = btn.getAttribute('data-stance') || 'agree';
            openStanceForm(root, stance, engState);
          } else if (action === 'cancel-stance') {
            const form = root.querySelector('[data-stance-form]');
            if (form) form.hidden = true;
          } else if (action === 'withdraw-stance') {
            if (!(await ensureCanEngage())) return;
            if (!confirm('Withdraw your agree/disagree position on this article?')) return;
            const r = await api(`/articles/${articleId}/debate`, { method: 'DELETE' });
            engState = r.engagement || {};
            updateCounts(root, engState);
            await refreshDebate(root, articleId);
            const form = root.querySelector('[data-stance-form]');
            if (form) {
              form.hidden = true;
              const ta = form.querySelector('textarea');
              if (ta) ta.value = '';
            }
          } else if (action === 'focus-comment') {
            if (btn.getAttribute('data-need-auth') === '1' && !(await ensureCanEngage())) return;
            const form = root.querySelector('[data-comment-form]');
            const section = root.querySelector('#eng-comments');
            if (form) {
              form.hidden = false;
              form.querySelector('textarea')?.focus();
            }
            section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch (err) {
          if (err.status === 401) location.href = loginNext();
          else alert(err.message || 'Action failed.');
        }
      });

      const stanceForm = root.querySelector('[data-stance-form]');
      if (stanceForm) {
        stanceForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!(await ensureCanEngage())) return;
          const stance = stanceForm.dataset.stance || 'agree';
          const ta = stanceForm.querySelector('textarea');
          const status = stanceForm.querySelector('[data-stance-status]');
          const reason = (ta?.value || '').trim();
          if (reason.length < REASON_MIN) {
            if (status) {
              status.textContent = `Please write at least ${REASON_MIN} characters explaining why.`;
              status.classList.add('is-error');
            }
            ta?.focus();
            return;
          }
          const submitBtn = stanceForm.querySelector('[data-stance-submit]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            const r = await api(`/articles/${articleId}/debate`, {
              method: 'POST',
              body: { stance, reason },
            });
            engState = r.engagement || engState;
            updateCounts(root, engState);
            if (r.debate) {
              renderDebateColumn(
                root.querySelector('[data-debate-agree]'),
                (r.debate || []).filter((x) => x.stance === 'agree'),
                'No agree arguments yet.',
              );
              renderDebateColumn(
                root.querySelector('[data-debate-disagree]'),
                (r.debate || []).filter((x) => x.stance === 'disagree'),
                'No disagree arguments yet.',
              );
            } else {
              await refreshDebate(root, articleId);
            }
            if (status) {
              status.classList.remove('is-error');
              status.textContent = stance === 'disagree'
                ? 'Disagree posted with your reason. It’s on the debate board below.'
                : 'Agree posted with your reason. It’s on the debate board below.';
            }
            stanceForm.hidden = true;
          } catch (err) {
            if (err.status === 401) location.href = loginNext();
            else if (status) {
              status.textContent = err.message || 'Could not post position.';
              status.classList.add('is-error');
            } else alert(err.message || 'Could not post position.');
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      const commentForm = root.querySelector('[data-comment-form]');
      if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!(await ensureCanEngage())) return;
          const ta = commentForm.querySelector('textarea');
          const body = (ta?.value || '').trim();
          if (body.length < 1) return;
          try {
            const r = await api(`/articles/${articleId}/comments`, { method: 'POST', body: { body } });
            ta.value = '';
            if (r.engagement) {
              engState = r.engagement;
              updateCounts(root, engState);
            }
            await refreshComments(root, articleId);
          } catch (err) {
            if (err.status === 401) location.href = loginNext();
            else alert(err.message || 'Could not post comment.');
          }
        });
      }
    } catch (err) {
      root.innerHTML = `<p class="eng-note">Article debate unavailable (${escapeHtml(err.message || 'error')}).</p>`;
    }
  }

  function paintPublisherState(root, data) {
    const following = Boolean(data.following);
    const liked = Boolean(data.liked);
    const subscribed = Boolean(data.subscribed);
    const followers = data.followerCount ?? data.stats?.followerCount ?? data.organization?.followerCount;
    const likes = data.likeCount ?? data.stats?.likeCount ?? data.organization?.likeCount;
    const articles = data.articleCount ?? data.stats?.articleCount ?? data.organization?.articleCount;
    const subscribers = data.subscriberCount ?? data.stats?.subscriberCount ?? data.organization?.subscriberCount;

    root.querySelectorAll('[data-action="follow-org"]').forEach((btn) => {
      btn.textContent = following ? 'Following' : 'Follow publisher';
      btn.classList.toggle('is-on', following);
    });
    root.querySelectorAll('[data-action="like-org"]').forEach((btn) => {
      btn.classList.toggle('is-on', liked);
    });
    root.querySelectorAll('[data-action="subscribe-org"]').forEach((btn) => {
      btn.textContent = subscribed ? 'Subscribed to updates' : 'Subscribe to updates';
      btn.classList.toggle('is-on', subscribed);
    });
    if (followers != null) {
      root.querySelectorAll('[data-follower-count], [data-pub-followers]').forEach((el) => {
        el.textContent = followers;
      });
    }
    if (likes != null) {
      root.querySelectorAll('[data-pub-likes], [data-pub-likes-btn], [data-pub-likes-stat]').forEach((el) => {
        el.textContent = likes;
      });
    }
    if (articles != null) {
      root.querySelectorAll('[data-pub-articles]').forEach((el) => {
        el.textContent = articles;
      });
    }
    if (subscribers != null) {
      root.querySelectorAll('[data-pub-subscribers]').forEach((el) => {
        el.textContent = subscribers;
      });
    }
  }

  function wirePublisherActions(root, orgId) {
    if (!root || !orgId || root.dataset.pubWired === '1') return;
    root.dataset.pubWired = '1';

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="follow-org"], [data-action="like-org"], [data-action="subscribe-org"]');
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      const action = btn.getAttribute('data-action');
      try {
        if (action === 'follow-org' || action === 'like-org') {
          if (!(await ensureCanEngage())) return;
          if (action === 'follow-org') {
            const r = await api('/publishers/follow', { method: 'POST', body: { organizationId: orgId } });
            paintPublisherState(root, r);
          } else {
            const r = await api('/publishers/like', { method: 'POST', body: { organizationId: orgId } });
            paintPublisherState(root, r);
          }
        } else if (action === 'subscribe-org') {
          // Logged-in: subscribe immediately. Guest: show email form if present, else prompt.
          try {
            const me = await api('/me');
            if (me.authenticated) {
              const r = await api('/publishers/subscribe', { method: 'POST', body: { organizationId: orgId } });
              paintPublisherState(root, {
                subscribed: true,
                subscriberCount: r.subscriberCount,
              });
              btn.textContent = 'Subscribed to updates';
              btn.classList.add('is-on');
              alert(r.message || 'Subscribed to publisher updates.');
              return;
            }
          } catch { /* fall through to form */ }

          const box = root.querySelector('[data-subscribe-box]')
            || document.querySelector(`[data-subscribe-box][data-org-id="${orgId}"]`);
          if (box) {
            box.hidden = false;
            box.querySelector('input[type="email"]')?.focus();
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            const email = window.prompt('Enter your email to subscribe to news updates from this publisher:');
            if (!email) return;
            const r = await api('/publishers/subscribe', {
              method: 'POST',
              body: { organizationId: orgId, email },
            });
            alert(r.message || 'Subscribed.');
            btn.textContent = 'Subscribed to updates';
            btn.classList.add('is-on');
          }
        }
      } catch (err) {
        if (err.status === 401) location.href = loginNext();
        else alert(err.message || 'Could not update publisher engagement.');
      }
    });

    const form = root.querySelector('[data-subscribe-form]');
    if (form && form.dataset.wired !== '1') {
      form.dataset.wired = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const status = root.querySelector('[data-subscribe-status]');
        try {
          const r = await api('/publishers/subscribe', {
            method: 'POST',
            body: {
              organizationId: orgId,
              email: String(fd.get('email') || ''),
              displayName: String(fd.get('displayName') || '') || undefined,
            },
          });
          if (status) status.textContent = r.message || 'Subscribed.';
          paintPublisherState(root, { subscribed: true, subscriberCount: r.subscriberCount });
          form.reset();
        } catch (err) {
          if (status) status.textContent = err.message || 'Could not subscribe.';
          else alert(err.message || 'Could not subscribe.');
        }
      });
    }
  }

  function initShareBars() {
    document.querySelectorAll('[data-share-bar]').forEach((bar) => {
      const url = bar.getAttribute('data-share-url') || location.href;
      const title = bar.getAttribute('data-share-title') || document.title;
      const text = bar.getAttribute('data-share-text') || title;
      const status = bar.querySelector('[data-share-status]');
      const nativeBtn = bar.querySelector('[data-share="native"]');
      if (nativeBtn && typeof navigator.share === 'function') {
        nativeBtn.hidden = false;
      }

      bar.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-share]');
        if (!el) return;
        const kind = el.getAttribute('data-share');
        if (kind === 'copy') {
          e.preventDefault();
          try {
            await navigator.clipboard.writeText(url);
            if (status) {
              status.hidden = false;
              status.textContent = 'Link copied.';
            }
          } catch {
            window.prompt('Copy this link:', url);
          }
        } else if (kind === 'native') {
          e.preventDefault();
          try {
            await navigator.share({ title, text, url });
          } catch { /* cancelled */ }
        }
        // whatsapp / email / sms use their hrefs
      });
    });
  }

  /** Compact publisher card above each article (follow + like + counts). */
  async function initPublisherCards() {
    const cards = document.querySelectorAll('[data-publisher-card][data-org-id]');
    for (const card of cards) {
      const orgId = Number(card.getAttribute('data-org-id'));
      const slug = card.getAttribute('data-org-slug');
      if (!orgId) continue;
      wirePublisherActions(card, orgId);
      if (slug) {
        try {
          const data = await api(`/publishers/${encodeURIComponent(slug)}`);
          paintPublisherState(card, {
            following: data.following,
            liked: data.liked,
            subscribed: data.subscribed,
            followerCount: data.organization?.followerCount ?? data.stats?.followerCount,
            likeCount: data.organization?.likeCount ?? data.stats?.likeCount,
            articleCount: data.organization?.articleCount ?? data.stats?.articleCount,
            subscriberCount: data.organization?.subscriberCount ?? data.stats?.subscriberCount,
          });
        } catch { /* keep server-rendered counts */ }
      }
    }
  }

  /** Full publisher profile page. */
  async function initPublisherPage() {
    const shell = document.querySelector('[data-publisher-org-id][data-publisher-profile]');
    if (!shell) {
      // Article pages may also mount a card; still wire any bare org shells without profile flag
      // only when there is no article debate panel confusion.
      return;
    }

    const orgId = Number(shell.getAttribute('data-publisher-org-id'));
    const slug = shell.getAttribute('data-publisher-slug');
    if (!orgId) return;

    wirePublisherActions(shell, orgId);

    if (slug) {
      try {
        const data = await api(`/publishers/${encodeURIComponent(slug)}`);
        paintPublisherState(shell, {
          following: data.following,
          liked: data.liked,
          subscribed: data.subscribed,
          followerCount: data.organization?.followerCount ?? data.stats?.followerCount,
          likeCount: data.organization?.likeCount ?? data.stats?.likeCount,
          articleCount: data.organization?.articleCount ?? data.stats?.articleCount,
          subscriberCount: data.organization?.subscriberCount ?? data.stats?.subscriberCount,
        });
      } catch { /* ignore */ }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initShareBars();
    initPublisherCards();
    initPublisherPage();
    initArticle();
  });
})();
