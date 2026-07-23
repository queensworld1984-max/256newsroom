const pool = require('./db');

/**
 * Create an in-app notification for one user.
 * Email delivery can be layered later via SMTP without changing call sites.
 */
async function notifyUser(userId, {
  kind,
  title,
  body = null,
  href = null,
  organizationId = null,
  meta = {},
} = {}) {
  if (!userId || !kind || !title) return null;
  const { rows } = await pool.query(
    `insert into user_notifications
      (user_id, kind, title, body, href, organization_id, meta)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning *`,
    [
      userId,
      String(kind).slice(0, 80),
      String(title).slice(0, 300),
      body != null ? String(body).slice(0, 4000) : null,
      href != null ? String(href).slice(0, 1000) : null,
      organizationId || null,
      JSON.stringify(meta || {}),
    ],
  );
  return rows[0];
}

/** Notify every user who holds a role on this organization. */
async function notifyOrgMembers(organizationId, payload) {
  if (!organizationId) return [];
  const { rows } = await pool.query(
    `select distinct ur.user_id
     from user_roles ur
     where ur.organization_id = $1`,
    [organizationId],
  );
  const created = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const n = await notifyUser(row.user_id, { ...payload, organizationId });
    if (n) created.push(n);
  }
  return created;
}

async function notifyApplicantAndOrg(application, payload) {
  const userIds = new Set();
  if (application?.applicant_user_id) userIds.add(Number(application.applicant_user_id));
  if (application?.organization_id) {
    const { rows } = await pool.query(
      `select distinct ur.user_id from user_roles ur where ur.organization_id = $1`,
      [application.organization_id],
    );
    for (const row of rows) userIds.add(Number(row.user_id));
  }
  const created = [];
  for (const userId of userIds) {
    // eslint-disable-next-line no-await-in-loop
    const n = await notifyUser(userId, {
      ...payload,
      organizationId: application.organization_id || payload.organizationId || null,
    });
    if (n) created.push(n);
  }
  return created;
}

module.exports = {
  notifyUser,
  notifyOrgMembers,
  notifyApplicantAndOrg,
};
