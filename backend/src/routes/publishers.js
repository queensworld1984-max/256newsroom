const express = require('express');
const pool = require('../db');

const router = express.Router();

// Badges are derived, never stored: an org's public page/badge is visible immediately
// on registration (per client decision), reflecting its literal verification_status,
// so an impersonator has nothing to gain from registering — they still can't publish
// (see requireApprovedOrg in stories.js) until an admin approves the application.
function deriveBadge(org) {
  if (org.is_official) return 'Official 256 Update';
  if (org.verification_status === 'approved') {
    return org.org_type === 'government_official' ? 'Official Government Source' : 'Verified Publisher';
  }
  if (org.verification_status === 'rejected' || org.verification_status === 'suspended') return null;
  return 'Registered Publisher (Unverified)';
}

router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select id, name, slug, org_type, description, logo_url, website_url,
              editorial_contact_email, social_links, verification_status, is_official,
              parent_organization_id, active
       from organizations
       where slug = $1`,
      [req.params.slug],
    );
    const org = rows[0];
    if (!org || !org.active) return res.status(404).json({ error: 'Publisher not found.' });

    res.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        orgType: org.org_type,
        description: org.description,
        logoUrl: org.logo_url,
        websiteUrl: org.website_url,
        editorialContactEmail: org.editorial_contact_email,
        socialLinks: org.social_links,
        verificationStatus: org.verification_status,
        badge: deriveBadge(org),
        parentOrganizationId: org.parent_organization_id,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.deriveBadge = deriveBadge;
