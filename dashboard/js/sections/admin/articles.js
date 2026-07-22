import { api, ApiError } from '../../api.js';
import { el, formatDate, statusBadgeClass } from '../../util.js';

const STATUSES = [['', 'All'], ['draft', 'Draft'], ['published', 'Published'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn'], ['archived', 'Archived']];

function toast(wrap, message, kind = 'error') {
  const existing = wrap.querySelector('.dash-toast');
  if (existing) existing.remove();
  wrap.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
}

function buildArticlePreview(article) {
  const preview = el('section', { class: 'generated-article-preview', hidden: true });
  preview.appendChild(el('div', { class: 'generated-article-preview-head' }, [
    el('span', { text: 'Full article preview' }),
    el('span', { text: `${(article.body || '').trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words` }),
  ]));
  preview.appendChild(el('h2', { text: article.title }));
  if (article.summary) preview.appendChild(el('p', { class: 'generated-article-standfirst', text: article.summary }));
  const body = el('div', { class: 'generated-article-body' });
  for (const paragraph of (article.body || 'No article body is available.').split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (!text) continue;
    const heading = text.match(/^#{1,4}\s+(.+)$/);
    body.appendChild(heading ? el('h3', { text: heading[1] }) : el('p', { text }));
  }
  preview.appendChild(body);
  return preview;
}

export async function render(container, ctx, opts) {
  const activeStatus = opts.status || '';
  const query = activeStatus ? `?status=${activeStatus}` : '';
  const { items } = await api.get(`/admin/ecosystem/articles${query}`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Generated Articles', style: 'margin-bottom:16px;' }));

  const tabs = el('div', { class: 'dash-actions', style: 'margin-bottom:14px;' });
  for (const [key, label] of STATUSES) {
    const a = el('a', { href: key ? `#/admin/ecosystem/articles?status=${key}` : '#/admin/ecosystem/articles' });
    const btn = el('button', { class: key === activeStatus ? 'small' : 'small secondary', text: label });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', key ? `#/admin/ecosystem/articles?status=${key}` : '#/admin/ecosystem/articles');
      render(container, ctx, { status: key || undefined });
    });
    a.appendChild(btn);
    tabs.appendChild(a);
  }
  wrap.appendChild(tabs);

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No generated articles in this view.' })]));
    container.innerHTML = '';
    container.appendChild(wrap);
    return;
  }

  for (const a of items) {
    const card = el('div', { class: 'dash-card' });
    card.appendChild(el('div', { class: 'dash-section-title' }, [
      el('div', {}, [
        el('a', { href: `#/stories/${a.id}/edit`, text: a.title, style: 'font-weight:700;' }),
        el('div', { style: 'color:var(--grey);font-size:12.5px;margin-top:4px;', text: `${a.platform_name} · ${a.content_type || 'Uncategorized'} · from ${a.source_domain || 'unknown source'}` }),
      ]),
      el('span', { class: `badge ${statusBadgeClass(a.status)}`, text: a.status }),
    ]));
    if (a.summary) card.appendChild(el('p', { style: 'margin-bottom:8px;font-size:13.5px;', text: a.summary }));
    card.appendChild(el('p', { style: 'color:var(--grey);font-size:12px;margin-bottom:10px;', text: `Generated ${formatDate(a.generated_at)}${a.published_at ? ' · Published ' + formatDate(a.published_at) : ''}` }));
    if (a.rejected_reason) card.appendChild(el('p', { style: 'color:var(--red);font-size:12.5px;margin-bottom:10px;', text: `Rejected: ${a.rejected_reason}` }));
    if (a.withdrawn_reason) card.appendChild(el('p', { style: 'color:var(--red);font-size:12.5px;margin-bottom:10px;', text: `Withdrawn: ${a.withdrawn_reason}` }));

    const preview = buildArticlePreview(a);
    const actions = el('div', { class: 'dash-actions' });
    const previewBtn = el('button', { class: 'small', text: 'Read full article' });
    previewBtn.addEventListener('click', () => {
      preview.hidden = !preview.hidden;
      previewBtn.textContent = preview.hidden ? 'Read full article' : 'Close article';
      if (!preview.hidden) preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    actions.appendChild(previewBtn);
    actions.appendChild(el('a', { href: `#/stories/${a.id}/edit` }, [el('button', { class: 'small secondary', text: 'Edit article' })]));
    if (['draft', 'pending_review'].includes(a.status)) {
      const approveBtn = el('button', { class: 'small', text: 'Approve & publish' });
      approveBtn.addEventListener('click', async () => {
        if (!confirm(`Approve and publish “${a.title}”?`)) return;
        try {
          await api.post(`/admin/ecosystem/articles/${a.id}/approve`, {});
          render(container, ctx, opts);
        } catch (err) {
          toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actions.appendChild(approveBtn);
    }
    if (!['rejected', 'withdrawn', 'archived'].includes(a.status)) {
      const rejectBtn = el('button', { class: 'small danger', text: 'Reject' });
      rejectBtn.addEventListener('click', async () => {
        const reason = prompt('Reason for rejecting this article:');
        if (reason === null) return;
        try {
          await api.post(`/admin/ecosystem/articles/${a.id}/reject`, { reason });
          render(container, ctx, opts);
        } catch (err) {
          toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actions.appendChild(rejectBtn);
    }
    if (a.status === 'published') {
      const withdrawBtn = el('button', { class: 'small danger', text: 'Withdraw' });
      withdrawBtn.addEventListener('click', async () => {
        const reason = prompt('Reason for withdrawing this article:');
        if (reason === null) return;
        try {
          await api.post(`/admin/ecosystem/articles/${a.id}/withdraw`, { reason });
          render(container, ctx, opts);
        } catch (err) {
          toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actions.appendChild(withdrawBtn);
    }
    if (a.status !== 'archived') {
      const archiveBtn = el('button', { class: 'small secondary', text: 'Archive' });
      archiveBtn.addEventListener('click', async () => {
        try {
          await api.post(`/admin/ecosystem/articles/${a.id}/archive`, {});
          render(container, ctx, opts);
        } catch (err) {
          toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
        }
      });
      actions.appendChild(archiveBtn);
    }
    card.appendChild(actions);
    card.appendChild(preview);
    wrap.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}
