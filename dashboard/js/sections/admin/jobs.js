import { api, ApiError } from '../../api.js';
import { el, formatDate } from '../../util.js';

const STATUSES = [['', 'All'], ['processing', 'Processing'], ['draft_ready', 'Draft ready'], ['published', 'Published'], ['rejected', 'Rejected'], ['failed', 'Failed'], ['skipped_duplicate', 'Skipped (duplicate)']];

function toast(wrap, message, kind = 'error') {
  const existing = wrap.querySelector('.dash-toast');
  if (existing) existing.remove();
  wrap.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
}

function jobBadgeClass(status) {
  return {
    published: 'badge-green', draft_ready: 'badge-green',
    rejected: 'badge-red', failed: 'badge-red',
    processing: 'badge-gold', skipped_duplicate: 'badge-grey',
  }[status] || 'badge-grey';
}

export async function render(container, ctx, opts) {
  const activeStatus = opts.status || '';
  const query = activeStatus ? `?status=${activeStatus}` : '';
  const { items } = await api.get(`/admin/ecosystem/jobs${query}`);

  const wrap = el('div');
  wrap.appendChild(el('h2', { text: 'Jobs & Audit Log', style: 'margin-bottom:16px;' }));

  const tabs = el('div', { class: 'dash-actions', style: 'margin-bottom:14px;' });
  for (const [key, label] of STATUSES) {
    const a = el('a', { href: key ? `#/admin/ecosystem/jobs?status=${key}` : '#/admin/ecosystem/jobs' });
    const btn = el('button', { class: key === activeStatus ? 'small' : 'small secondary', text: label });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', key ? `#/admin/ecosystem/jobs?status=${key}` : '#/admin/ecosystem/jobs');
      render(container, ctx, { status: key || undefined });
    });
    a.appendChild(btn);
    tabs.appendChild(a);
  }
  wrap.appendChild(tabs);

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'dash-card' }, [el('p', { class: 'dash-empty', text: 'No jobs in this view.' })]));
    container.innerHTML = '';
    container.appendChild(wrap);
    return;
  }

  const table = el('table', { class: 'dash-table' });
  table.innerHTML = '<thead><tr><th>Platform</th><th>Status</th><th>Model</th><th>Triggered by</th><th>Started</th><th>Detail</th><th></th></tr></thead>';
  const tbody = el('tbody');
  for (const j of items) {
    const detailTd = el('td', { style: 'max-width:260px;font-size:12px;color:var(--grey);' });
    if (j.error) detailTd.textContent = j.error;
    else if (j.article_id) detailTd.appendChild(el('a', { href: `#/stories/${j.article_id}/edit`, text: `View article #${j.article_id}` }));

    const actionsTd = el('td');
    if (['rejected', 'failed'].includes(j.status)) {
      const retryBtn = el('button', { class: 'small secondary', text: 'Retry' });
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Retrying…';
        try {
          const result = await api.post(`/admin/ecosystem/jobs/${j.id}/retry`, {});
          toast(wrap, result.article ? `Retry succeeded: "${result.article.title}"` : `Retry result: ${result.job.status}${result.job.error ? ' — ' + result.job.error : ''}`, result.article ? 'success' : 'error');
          setTimeout(() => render(container, ctx, opts), 1000);
        } catch (err) {
          retryBtn.disabled = false;
          retryBtn.textContent = 'Retry';
          toast(wrap, err instanceof ApiError ? err.message : 'Retry failed.');
        }
      });
      actionsTd.appendChild(retryBtn);
    }

    tbody.appendChild(el('tr', {}, [
      el('td', { text: j.organization_name }),
      el('td', {}, [el('span', { class: `badge ${jobBadgeClass(j.status)}`, text: j.status.replace(/_/g, ' ') })]),
      el('td', { text: j.generation_model || '—' }),
      el('td', { text: j.triggered_by }),
      el('td', { text: formatDate(j.started_at) }),
      detailTd,
      actionsTd,
    ]));
  }
  table.appendChild(tbody);
  wrap.appendChild(el('div', { class: 'dash-card' }, [table]));

  container.innerHTML = '';
  container.appendChild(wrap);
}
