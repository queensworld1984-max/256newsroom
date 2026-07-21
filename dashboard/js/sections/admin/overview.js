import { api, ApiError } from '../../api.js';
import { el, formatDate } from '../../util.js';

function toast(wrap, message, kind = 'error') {
  const existing = wrap.querySelector('.dash-toast');
  if (existing) existing.remove();
  wrap.prepend(el('div', { class: `dash-toast ${kind}`, text: message }));
}

export async function render(container, ctx) {
  const [{ items: platforms }, { paused }, { items: recentJobs }] = await Promise.all([
    api.get('/admin/ecosystem/platforms'),
    api.get('/admin/ecosystem/global-settings'),
    api.get('/admin/ecosystem/jobs'),
  ]);

  const wrap = el('div');
  wrap.appendChild(el('div', { class: 'dash-section-title' }, [
    el('h2', { text: 'Ecosystem Automation — Overview' }),
  ]));

  const pauseCard = el('div', { class: 'dash-card' }, [
    el('h3', { text: 'Global automation switch' }),
    el('p', { style: 'margin:8px 0 12px;color:var(--grey);font-size:13px;', text: 'Pausing here stops discovery, generation, and scheduling for every platform at once, regardless of individual platform modes.' }),
  ]);
  const pauseRow = el('div', { class: 'dash-actions' });
  pauseRow.appendChild(el('span', { class: `badge ${paused ? 'badge-red' : 'badge-green'}`, text: paused ? 'Paused' : 'Running' }));
  const toggleBtn = el('button', { class: paused ? '' : 'danger', text: paused ? 'Resume automation' : 'Pause all automation' });
  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    try {
      await api.post('/admin/ecosystem/global-settings', { paused: !paused });
      render(container, ctx);
    } catch (err) {
      toggleBtn.disabled = false;
      toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  pauseRow.appendChild(toggleBtn);
  const runBtn = el('button', { class: 'secondary', text: 'Run cycle now' });
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running… this can take a minute or two';
    try {
      const result = await api.post('/admin/ecosystem/run-cycle', {});
      const summary = result.skipped
        ? 'Skipped — automation is globally paused.'
        : result.results.map((r) => `${r.name}: ${r.status}`).join(' · ');
      toast(wrap, summary, 'success');
      setTimeout(() => render(container, ctx), 1200);
    } catch (err) {
      runBtn.disabled = false;
      runBtn.textContent = 'Run cycle now';
      toast(wrap, err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  });
  pauseRow.appendChild(runBtn);
  pauseCard.appendChild(pauseRow);
  wrap.appendChild(pauseCard);

  const table = el('table', { class: 'dash-table' });
  table.innerHTML = '<thead><tr><th>Platform</th><th>Mode</th><th>Target / Max per day</th><th>Min interval</th><th>Timezone</th></tr></thead>';
  const tbody = el('tbody');
  for (const p of platforms) {
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [el('a', { href: `#/admin/ecosystem/platforms/${p.id}`, text: p.name })]),
      el('td', {}, [el('span', { class: `badge ${p.mode === 'automatic' ? 'badge-green' : p.mode === 'paused' ? 'badge-red' : 'badge-gold'}`, text: p.mode })]),
      el('td', { text: `${p.daily_target} / ${p.daily_max}` }),
      el('td', { text: `${p.min_interval_minutes} min` }),
      el('td', { text: p.timezone }),
    ]));
  }
  table.appendChild(tbody);
  wrap.appendChild(el('div', { class: 'dash-card' }, [el('h3', { text: 'Platforms', style: 'margin-bottom:10px;' }), table]));

  const jobsCard = el('div', { class: 'dash-card' }, [el('h3', { text: 'Recent jobs', style: 'margin-bottom:10px;' })]);
  if (!recentJobs.length) {
    jobsCard.appendChild(el('p', { class: 'dash-empty', text: 'No generation jobs have run yet.' }));
  } else {
    const jobsTable = el('table', { class: 'dash-table' });
    jobsTable.innerHTML = '<thead><tr><th>Platform</th><th>Status</th><th>Started</th></tr></thead>';
    const jobsBody = el('tbody');
    for (const j of recentJobs.slice(0, 10)) {
      jobsBody.appendChild(el('tr', {}, [
        el('td', { text: j.organization_name }),
        el('td', {}, [el('span', { class: 'badge badge-grey', text: j.status.replace(/_/g, ' ') })]),
        el('td', { text: formatDate(j.started_at) }),
      ]));
    }
    jobsTable.appendChild(jobsBody);
    jobsCard.appendChild(jobsTable);
    jobsCard.appendChild(el('a', { href: '#/admin/ecosystem/jobs', text: 'View all jobs →', style: 'display:inline-block;margin-top:10px;' }));
  }
  wrap.appendChild(jobsCard);

  container.innerHTML = '';
  container.appendChild(wrap);
}
