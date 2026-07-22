const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

const STAGES = ['application', 'identity_review', 'website_verification', 'approved', 'rejected'];
const STAGE_TO_VERIFICATION_STATUS = {
  application: 'unverified',
  identity_review: 'identity_review',
  website_verification: 'website_verification',
  approved: 'approved',
  rejected: 'rejected',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'rss', 'publisher', 'publishers', 'journalists', 'people', 'news', 'assets', 'robots.txt',
]);

async function uniqueOrgSlug(name) {
  const base = slugify(name) || crypto.randomBytes(4).toString('hex');
  let candidate = base;
  let suffix = 1;
  for (;;) {
    if (!RESERVED_SLUGS.has(candidate)) {
      const { rows } = await pool.query('select 1 from organizations where slug = $1', [candidate]);
      if (!rows.length) return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// Creates the organization (visible publicly immediately, badged by its
// verification_status) and its application record in one transaction, then makes
// the applicant its publisher_owner. Publishing capability stays gated separately —
// see isOrgApproved in storiesCore.js — until an admin approves the application.
// Requires verifiable org contact details so random accounts cannot casually
// claim an outlet and start publishing under its name.
router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { cleanPhone, cleanEmail, cleanUrl } = require('../identity');

    const name = String(req.body.name || '').trim().slice(0, 200);
    const orgType = String(req.body.orgType || 'local_publisher');
    const websiteUrl = cleanUrl(req.body.websiteUrl);
    const description = req.body.description ? String(req.body.description).trim().slice(0, 2000) : null;
    const physicalAddress = String(req.body.physicalAddress || '').trim().slice(0, 500);
    const contactPersonName = String(req.body.contactPersonName || '').trim().slice(0, 160);
    const contactPersonTitle = String(req.body.contactPersonTitle || '').trim().slice(0, 120) || null;
    const contactPersonEmail = cleanEmail(req.body.contactPersonEmail);
    const contactPersonPhone = cleanPhone(req.body.contactPersonPhone);
    const contactPersonWhatsapp = cleanPhone(req.body.contactPersonWhatsapp);
    const editorialContactEmail = cleanEmail(req.body.editorialContactEmail) || contactPersonEmail;
    const editorialContactPhone = cleanPhone(req.body.editorialContactPhone) || contactPersonPhone;
    const businessDetails = req.body.businessDetails && typeof req.body.businessDetails === 'object' ? req.body.businessDetails : {};

    if (!name) return res.status(400).json({ error: 'Organization name is required.' });
    if (physicalAddress.length < 8) return res.status(400).json({ error: 'Physical address of the organization is required.' });
    if (contactPersonName.length < 2) return res.status(400).json({ error: 'Contact person full name is required.' });
    if (contactPersonEmail === false || !contactPersonEmail) {
      return res.status(400).json({ error: 'A valid contact person email is required.' });
    }
    if (contactPersonPhone === false || !contactPersonPhone) {
      return res.status(400).json({ error: 'A valid contact person phone number is required.' });
    }
    if (websiteUrl === false) return res.status(400).json({ error: 'Website URL must start with http:// or https://.' });
    if (contactPersonWhatsapp === false) return res.status(400).json({ error: 'WhatsApp number looks invalid.' });
    if (editorialContactEmail === false) return res.status(400).json({ error: 'Editorial contact email looks invalid.' });
    if (editorialContactPhone === false) return res.status(400).json({ error: 'Editorial contact phone looks invalid.' });

    const { rows: existingApp } = await client.query(
      `select pa.id from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where pa.applicant_user_id = $1 and pa.stage not in ('rejected')`,
      [req.user.id],
    );
    if (existingApp.length) {
      return res.status(409).json({ error: 'You already have an active or approved publisher application.' });
    }

    const slug = await uniqueOrgSlug(name);

    await client.query('begin');
    const { rows: orgRows } = await client.query(
      `insert into organizations
        (name, slug, org_type, description, website_url, editorial_contact_email, editorial_contact_phone,
         physical_address, contact_person_name, contact_person_title, contact_person_email,
         contact_person_phone, contact_person_whatsapp, verification_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'unverified')
       returning id, slug, verification_status`,
      [
        name, slug, orgType, description, websiteUrl, editorialContactEmail, editorialContactPhone,
        physicalAddress, contactPersonName, contactPersonTitle, contactPersonEmail,
        contactPersonPhone, contactPersonWhatsapp || null,
      ],
    );
    const organizationId = orgRows[0].id;

    const enrichedBusinessDetails = {
      ...businessDetails,
      physicalAddress,
      contactPerson: {
        name: contactPersonName,
        title: contactPersonTitle,
        email: contactPersonEmail,
        phone: contactPersonPhone,
        whatsapp: contactPersonWhatsapp || null,
      },
    };

    const { rows: appRows } = await client.query(
      `insert into publisher_applications (organization_id, applicant_user_id, stage, business_details)
       values ($1, $2, 'application', $3)
       returning id, stage, submitted_at`,
      [organizationId, req.user.id, enrichedBusinessDetails],
    );

    await client.query(
      `insert into application_stage_events (application_id, from_stage, to_stage, actor_user_id, note)
       values ($1, null, 'application', $2, 'Application submitted')`,
      [appRows[0].id, req.user.id],
    );

    const { rows: ownerRoleRows } = await client.query("select id from roles where key = 'publisher_owner'");
    await client.query(
      `insert into user_roles (user_id, role_id, organization_id) values ($1, $2, $3) on conflict do nothing`,
      [req.user.id, ownerRoleRows[0].id, organizationId],
    );

    await client.query('commit');
    res.status(201).json({
      organization: { id: organizationId, slug: orgRows[0].slug, verificationStatus: orgRows[0].verification_status },
      application: { id: appRows[0].id, stage: appRows[0].stage, submittedAt: appRows[0].submitted_at },
    });
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select pa.id, pa.stage, pa.submitted_at, pa.decided_at, pa.review_notes,
              o.id as organization_id, o.name, o.slug, o.verification_status
       from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where pa.applicant_user_id = $1
       order by pa.submitted_at desc`,
      [req.user.id],
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/website-verification/start', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select pa.*, o.website_url from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where pa.id = $1 and pa.applicant_user_id = $2`,
      [req.params.id, req.user.id],
    );
    const application = rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (!application.website_url) return res.status(400).json({ error: 'Add a website URL to the organization profile first.' });

    const token = `256newsroom-verify-${crypto.randomBytes(12).toString('hex')}`;
    await pool.query(
      `update publisher_applications
       set website_verification_method = 'meta_tag', website_verification_token = $2
       where id = $1`,
      [application.id, token],
    );
    res.json({
      token,
      instructions: `Add <meta name="256newsroom-verification" content="${token}"> to your homepage <head>, then call the check endpoint.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/website-verification/check', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select pa.*, o.website_url from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where pa.id = $1 and pa.applicant_user_id = $2`,
      [req.params.id, req.user.id],
    );
    const application = rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (!application.website_verification_token) return res.status(400).json({ error: 'Start website verification first.' });

    let verified = false;
    try {
      const response = await fetch(application.website_url, { signal: AbortSignal.timeout(10000) });
      const html = await response.text();
      verified = html.includes(application.website_verification_token);
    } catch (err) {
      return res.status(502).json({ error: `Could not fetch website: ${err.message}` });
    }

    if (!verified) return res.status(400).json({ error: 'Verification token not found on the website homepage.' });

    await pool.query('update publisher_applications set website_verified_at = now() where id = $1', [application.id]);
    res.json({ ok: true, websiteVerifiedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.STAGES = STAGES;
module.exports.STAGE_TO_VERIFICATION_STATUS = STAGE_TO_VERIFICATION_STATUS;

const adminRouter = express.Router();
module.exports.adminRouter = adminRouter;

adminRouter.get('/', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select pa.id, pa.stage, pa.submitted_at, pa.decided_at, pa.review_notes,
              o.id as organization_id, o.name, o.slug, o.org_type, o.website_url, o.verification_status,
              o.physical_address, o.contact_person_name, o.contact_person_email, o.contact_person_phone
       from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where o.excluded_from_verification_queue = false
       order by pa.submitted_at desc`,
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/:id', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select pa.*, o.name, o.slug, o.org_type, o.website_url, o.verification_status,
              o.physical_address, o.contact_person_name, o.contact_person_title,
              o.contact_person_email, o.contact_person_phone, o.contact_person_whatsapp,
              o.editorial_contact_email, o.editorial_contact_phone
       from publisher_applications pa
       join organizations o on o.id = pa.organization_id
       where pa.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found.' });
    const { rows: events } = await pool.query(
      'select * from application_stage_events where application_id = $1 order by created_at asc',
      [req.params.id],
    );
    res.json({ application: rows[0], events });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/:id/advance', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = req.body.note ? String(req.body.note).slice(0, 1000) : null;
    const { rows } = await client.query('select * from publisher_applications where id = $1', [req.params.id]);
    const application = rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    const currentIndex = STAGES.indexOf(application.stage);
    if (currentIndex === -1 || currentIndex >= STAGES.indexOf('approved')) {
      return res.status(400).json({ error: `Application is already at stage '${application.stage}'.` });
    }
    const nextStage = STAGES[currentIndex + 1];

    await client.query('begin');
    await client.query(
      `update publisher_applications
       set stage = $2, reviewed_by_user_id = $3, review_notes = coalesce($4, review_notes),
           decided_at = case when $2 = 'approved' then now() else decided_at end
       where id = $1`,
      [application.id, nextStage, req.user.id, note],
    );
    await client.query(
      `update organizations set verification_status = $2, updated_at = now() where id = $1`,
      [application.organization_id, STAGE_TO_VERIFICATION_STATUS[nextStage]],
    );
    await client.query(
      `insert into application_stage_events (application_id, from_stage, to_stage, actor_user_id, note)
       values ($1, $2, $3, $4, $5)`,
      [application.id, application.stage, nextStage, req.user.id, note],
    );
    await client.query('commit');
    res.json({ ok: true, stage: nextStage });
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});

adminRouter.post('/:id/reject', requireRole('super_admin', 'newsroom_admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = req.body.note ? String(req.body.note).slice(0, 1000) : null;
    const { rows } = await client.query('select * from publisher_applications where id = $1', [req.params.id]);
    const application = rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    await client.query('begin');
    await client.query(
      `update publisher_applications set stage = 'rejected', reviewed_by_user_id = $2, review_notes = $3, decided_at = now() where id = $1`,
      [application.id, req.user.id, note],
    );
    await client.query(
      `update organizations set verification_status = 'rejected', updated_at = now() where id = $1`,
      [application.organization_id],
    );
    await client.query(
      `insert into application_stage_events (application_id, from_stage, to_stage, actor_user_id, note)
       values ($1, $2, 'rejected', $3, $4)`,
      [application.id, application.stage, req.user.id, note],
    );
    await client.query('commit');
    res.json({ ok: true, stage: 'rejected' });
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});
