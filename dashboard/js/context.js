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

  return {
    user,
    isGlobalAdmin,
    isEditor,
    organization,
    orgId: orgRole ? orgRole.organizationId : null,
    isIndependentJournalist,
    mode: organization ? 'org' : (isIndependentJournalist ? 'independent' : 'onboarding'),
  };
}
