const express = require('express');
const pool = require('../db');
const { hashPassword, verifyPassword, createSession, destroySession, requireAuth } = require('../auth');
const { createRateLimiter } = require('../rateLimit');

const router = express.Router();

const loginRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts from this connection. Please try again later.',
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim().slice(0, 120) || null;

    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email address is required.' });
    if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

    const existing = await pool.query('select id from users where email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `insert into users (email, password_hash, display_name, status)
       values ($1, $2, $3, 'active')
       returning id, email, display_name`,
      [email, passwordHash, displayName],
    );

    await createSession(rows[0].id, req, res);
    res.status(201).json({ user: { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name, roles: [] } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const { rows } = await pool.query('select id, email, password_hash, status from users where email = $1', [email]);
    const user = rows[0];
    const ok = user && user.status === 'active' && (await verifyPassword(user.password_hash, password));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    await pool.query('update users set last_login_at = now() where id = $1', [user.id]);
    await createSession(user.id, req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters.' });

    const { rows } = await pool.query('select password_hash from users where id = $1', [req.user.id]);
    const ok = await verifyPassword(rows[0]?.password_hash, currentPassword);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await hashPassword(newPassword);
    await pool.query('update users set password_hash = $1, updated_at = now() where id = $2', [newHash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Self-serve independent journalist onboarding. Requires National ID (hashed),
// district, topic beats, and contact details. Unlike publisher orgs, there is
// no admin publish gate (see isOrgApproved in storiesCore.js for organizationId=null).
router.post('/become-independent-journalist', requireAuth, async (req, res, next) => {
  try {
    const {
      normalizeNationalId,
      isPlausibleNationalId,
      hashNationalId,
      nationalIdLast4,
      cleanPhone,
      cleanEmail,
      cleanUrl,
    } = require('../identity');

    const displayName = String(req.body.displayName || req.body.name || req.user.displayName || '').trim().slice(0, 160);
    const nationalIdRaw = normalizeNationalId(req.body.nationalId);
    const districtSlug = String(req.body.districtSlug || '').trim().slice(0, 80);
    const websiteUrl = cleanUrl(req.body.websiteUrl);
    const whatsapp = cleanPhone(req.body.whatsappNumber || req.body.whatsapp);
    const contactPhone = cleanPhone(req.body.contactPhone || req.body.phone);
    const contactEmail = cleanEmail(req.body.contactEmail) || cleanEmail(req.user.email);
    let topicSlugs = req.body.topicSlugs || req.body.topics || [];
    if (typeof topicSlugs === 'string') {
      topicSlugs = topicSlugs.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(topicSlugs)) topicSlugs = [];
    topicSlugs = topicSlugs.map((t) => String(t).trim().toLowerCase().slice(0, 60)).filter(Boolean).slice(0, 12);

    if (displayName.length < 2) {
      return res.status(400).json({ error: 'Your public journalist name is required.' });
    }
    if (!isPlausibleNationalId(nationalIdRaw)) {
      return res.status(400).json({ error: 'A valid National ID (NIN) is required to register as an independent journalist.' });
    }
    if (!districtSlug) {
      return res.status(400).json({ error: 'Choose your primary reporting district.' });
    }
    if (!topicSlugs.length) {
      return res.status(400).json({ error: 'Choose at least one topic or beat you publish on.' });
    }
    if (websiteUrl === false) return res.status(400).json({ error: 'Website URL must start with http:// or https://.' });
    if (whatsapp === false) return res.status(400).json({ error: 'WhatsApp number looks invalid.' });
    if (contactPhone === false) return res.status(400).json({ error: 'Contact phone looks invalid.' });
    if (contactEmail === false || !contactEmail) {
      return res.status(400).json({ error: 'A valid contact email is required.' });
    }
    if (!whatsapp && !contactPhone) {
      return res.status(400).json({ error: 'Provide a WhatsApp number or contact phone.' });
    }

    const { rows: districtRows } = await pool.query('select id from districts where slug = $1', [districtSlug]);
    if (!districtRows.length) return res.status(400).json({ error: 'Unknown district. Pick one from the list.' });

    // Validate topic slugs against categories when provided as known taxonomy.
    const { rows: catRows } = await pool.query('select slug from categories where slug = any($1::text[])', [topicSlugs]);
    const known = new Set(catRows.map((r) => r.slug));
    const unknown = topicSlugs.filter((s) => !known.has(s));
    if (unknown.length) {
      return res.status(400).json({ error: `Unknown topic(s): ${unknown.join(', ')}. Choose from the newsroom categories.` });
    }

    const ninHash = hashNationalId(nationalIdRaw);
    const { rows: ninClash } = await pool.query(
      'select id from journalists where national_id_hash = $1 and (user_id is distinct from $2)',
      [ninHash, req.user.id],
    );
    if (ninClash.length) {
      return res.status(409).json({ error: 'This National ID is already linked to another journalist account.' });
    }

    const { rows: roleRows } = await pool.query("select id from roles where key = 'independent_journalist'");
    await pool.query(
      'insert into user_roles (user_id, role_id, organization_id) values ($1, $2, null) on conflict do nothing',
      [req.user.id, roleRows[0].id],
    );

    const { rows: existing } = await pool.query('select id from journalists where user_id = $1', [req.user.id]);
    const beat = topicSlugs.join(', ');
    if (!existing.length) {
      const baseSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'journalist';
      let slug = baseSlug;
      let suffix = 1;
      for (;;) {
        const { rows: clash } = await pool.query('select 1 from journalists where slug = $1', [slug]);
        if (!clash.length) break;
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }
      await pool.query(
        `insert into journalists
          (name, slug, user_id, is_independent, beat, national_id_hash, national_id_last4,
           district_id, topic_slugs, website_url, whatsapp_number, contact_phone, contact_email,
           location, identity_status)
         values ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'self_declared')`,
        [
          displayName, slug, req.user.id, beat, ninHash, nationalIdLast4(nationalIdRaw),
          districtRows[0].id, topicSlugs, websiteUrl, whatsapp, contactPhone, contactEmail,
          districtSlug,
        ],
      );
    } else {
      await pool.query(
        `update journalists set
           name = $2, beat = $3, national_id_hash = $4, national_id_last4 = $5,
           district_id = $6, topic_slugs = $7, website_url = coalesce($8, website_url),
           whatsapp_number = $9, contact_phone = $10, contact_email = $11,
           location = $12, is_independent = true, identity_status = 'self_declared',
           updated_at = now()
         where user_id = $1`,
        [
          req.user.id, displayName, beat, ninHash, nationalIdLast4(nationalIdRaw),
          districtRows[0].id, topicSlugs, websiteUrl, whatsapp, contactPhone, contactEmail,
          districtSlug,
        ],
      );
    }

    if (req.user.displayName !== displayName) {
      await pool.query('update users set display_name = $2, updated_at = now() where id = $1', [req.user.id, displayName]);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/journalist-profile', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select j.id, j.name, j.slug, j.beat, j.bio, j.location, j.website_url, j.image_url, j.verified,
              j.topic_slugs, j.whatsapp_number, j.contact_phone, j.contact_email, j.national_id_last4,
              j.identity_status, d.slug as district_slug, d.name as district_name
       from journalists j
       left join districts d on d.id = j.district_id
       where j.user_id = $1`,
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Activate your independent journalist account first.' });
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
});

router.patch('/journalist-profile', requireAuth, async (req, res, next) => {
  try {
    const cleanUrl = (value) => {
      const url = String(value || '').trim().slice(0, 1000);
      return !url || /^https?:\/\//i.test(url) ? (url || null) : false;
    };
    const websiteUrl = cleanUrl(req.body.websiteUrl);
    const imageUrl = cleanUrl(req.body.imageUrl);
    if (websiteUrl === false || imageUrl === false) return res.status(400).json({ error: 'Website and photo must use a valid http(s) URL.' });
    const name = String(req.body.name || '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const { rows } = await pool.query(
      `update journalists set name=$2, beat=$3, bio=$4, location=$5, website_url=$6, image_url=$7,
       profile_url='/journalists/profile.html?slug=' || slug, updated_at=now()
       where user_id=$1 returning id, name, slug, beat, bio, location, website_url, image_url, profile_url, verified`,
      [req.user.id, name, String(req.body.beat || '').trim().slice(0, 160) || null,
        String(req.body.bio || '').trim().slice(0, 2000) || null, String(req.body.location || '').trim().slice(0, 160) || null,
        websiteUrl, imageUrl],
    );
    if (!rows.length) return res.status(404).json({ error: 'Activate your independent journalist account first.' });
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
