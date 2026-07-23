import { api } from './api.js';

const GLOBAL_ADMIN_ROLES = new Set(['super_admin', 'newsroom_admin']);
const EDITOR_ROLES = new Set(['publisher_owner', 'publisher_editor']);
const ORG_ROLES = new Set(['publisher_owner', 'publisher_editor', 'journalist']);

export async function loadContext() {
  const { user } = await api.get('/auth/me');
  if (!user) return { user: null };

  const isGlobalAdmin = user.roles.some((r) => GLOBAL_ADMIN_ROLES.has(r.key));
  const orgRole = user.roles.find((r) => ORG_ROLES.has(r.key) && r.organizationId);
  const isIndependentJournalist = user.roles.some((r) => r.key === 'independent_journalist');

  // Global admins default into the control room unless they explicitly switch workspace.
  if (isGlobalAdmin && !sessionStorage.getItem('nr_workspace')) {
    sessionStorage.setItem('nr_workspace', 'admin');
  }

  let organization = null;
  let isEditor = isGlobalAdmin;
  if (orgRole) {
    try {
      const { organization: org } = await api.get(`/publishers/${orgRole.organizationId}`);
      organization = org;
      isEditor = isEditor || EDITOR_ROLES.has(orgRole.key);
    } catch (err) {
      // Never block the whole dashboard if the personal outlet profile fails to load.
      console.warn('Could not load organization workspace', err);
      organization = null;
    }
  }

  const orgApproved = Boolean(
    organization && (organization.verification_status === 'approved' || organization.is_official),
  );
  // Publishers with an active website may post immediately; formal verification is admin/AI-driven.
  const orgHasActiveWebsite = (() => {
    const url = String(organization?.website_url || '').trim();
    if (!url) return false;
    try {
      const parsed = new URL(url.includes('://') ? url : `https://${url}`);
      return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  })();
  const orgCanPublish = Boolean(
    organization && organization.active !== false
    && (orgApproved || orgHasActiveWebsite),
  );

  const workspaceHint = sessionStorage.getItem('nr_workspace');

  let mode = 'onboarding';
  if (isGlobalAdmin && workspaceHint !== 'org' && workspaceHint !== 'independent') {
    mode = 'admin';
  } else if (organization) {
    mode = 'org';
  } else if (isIndependentJournalist) {
    mode = 'independent';
  } else if (isGlobalAdmin) {
    mode = 'admin';
  }

  return {
    user,
    isGlobalAdmin,
    isEditor,
    organization,
    orgId: orgRole ? orgRole.organizationId : null,
    orgApproved,
    orgHasActiveWebsite,
    orgCanPublish,
    isIndependentJournalist,
    canPublish: isIndependentJournalist || orgCanPublish || isGlobalAdmin,
    mode,
    hasOrgWorkspace: Boolean(organization) || Boolean(orgRole),
  };
}

export function setWorkspace(workspace) {
  if (workspace === 'admin' || workspace === 'org' || workspace === 'independent') {
    sessionStorage.setItem('nr_workspace', workspace);
  } else {
    sessionStorage.removeItem('nr_workspace');
  }
}
