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

  let organization = null;
  let isEditor = isGlobalAdmin;
  if (orgRole) {
    const { organization: org } = await api.get(`/publishers/${orgRole.organizationId}`);
    organization = org;
    isEditor = isEditor || EDITOR_ROLES.has(orgRole.key);
  }

  const orgApproved = Boolean(
    organization && (organization.verification_status === 'approved' || organization.is_official),
  );

  // Workspace mode:
  // - Global admins land in the platform control room (not a shallow publisher shell).
  // - They can still open their personal outlet via ?workspace=org when needed.
  let mode = 'onboarding';
  const workspaceHint = new URLSearchParams(window.location.hash.split('?')[1] || '').get('workspace')
    || sessionStorage.getItem('nr_workspace');

  if (isGlobalAdmin && workspaceHint !== 'org' && workspaceHint !== 'independent') {
    mode = 'admin';
  } else if (organization && orgApproved) {
    mode = 'org';
  } else if (isIndependentJournalist) {
    mode = 'independent';
  } else if (organization) {
    mode = 'org';
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
    isIndependentJournalist,
    canPublish: isIndependentJournalist || orgApproved || isGlobalAdmin,
    mode,
    hasOrgWorkspace: Boolean(organization),
  };
}

export function setWorkspace(workspace) {
  if (workspace === 'admin' || workspace === 'org' || workspace === 'independent') {
    sessionStorage.setItem('nr_workspace', workspace);
  } else {
    sessionStorage.removeItem('nr_workspace');
  }
}
