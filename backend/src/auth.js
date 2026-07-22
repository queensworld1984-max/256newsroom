const argon2 = require('argon2');
const pool = require('./db');

const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function verifyPassword(hash, password) {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

async function createSession(userId, req, res) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const { rows } = await pool.query(
    `insert into sessions (user_id, expires_at, user_agent, ip)
     values ($1, $2, $3, $4)
     returning id`,
    [userId, expiresAt, req.header('user-agent') || null, req.ip || null],
  );
  res.cookie(SESSION_COOKIE, rows[0].id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return rows[0].id;
}

async function destroySession(req, res) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    await pool.query('delete from sessions where id = $1', [sid]);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

async function loadSessionUser(req, _res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return next();

  try {
    const { rows } = await pool.query(
      `select u.id, u.email, u.display_name, u.status
       from sessions s
       join users u on u.id = s.user_id
       where s.id = $1 and s.expires_at > now()`,
      [sid],
    );
    if (!rows.length || rows[0].status !== 'active') return next();

    const user = rows[0];
    const { rows: roleRows } = await pool.query(
      `select r.key, ur.organization_id
       from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = $1`,
      [user.id],
    );

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      roles: roleRows.map((row) => ({ key: row.key, organizationId: row.organization_id })),
    };

    pool.query('update sessions set last_seen_at = now() where id = $1', [sid]).catch(() => {});
  } catch (err) {
    console.error('loadSessionUser failed:', err);
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

const GLOBAL_ADMIN_ROLES = new Set(['super_admin', 'newsroom_admin']);

function hasGlobalAdminRole(user) {
  return Boolean(user?.roles?.some((role) => GLOBAL_ADMIN_ROLES.has(role.key)));
}

function requireRole(...roleKeys) {
  const allowed = new Set(roleKeys);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const ok = req.user.roles.some((role) => allowed.has(role.key));
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function requireOrgAccess(paramName) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (hasGlobalAdminRole(req.user)) return next();

    const orgId = Number(req.params[paramName]);
    const ok = req.user.roles.some((role) => Number(role.organizationId) === orgId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  loadSessionUser,
  requireAuth,
  requireRole,
  requireOrgAccess,
  hasGlobalAdminRole,
};
