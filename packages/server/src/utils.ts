/** Reserved slugs that conflict with route patterns */
const RESERVED_SLUGS = new Set(['new', 'create', 'edit', 'delete', 'index', 'api', 'admin', 'auth', 'settings']);

/** Generate a URL-safe slug from a string */
export function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  // Prevent reserved slugs from colliding with routes
  if (RESERVED_SLUGS.has(slug)) {
    slug = `${slug}-${Date.now()}`;
  }

  return slug;
}

// --- Hub Permission Helpers ---

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  steward: 2,
  member: 1,
};

const PERMISSION_MAP: Record<string, number> = {
  editHub: 3,          // admin+
  manageMembers: 3,    // admin+
  reviewFlags: 3,      // admin+ (review/resolve the hub flag queue)
  banUser: 2,          // moderator+
  kickMember: 2,       // moderator+
  deletePost: 2,       // moderator+
  pinPost: 2,          // moderator+
  lockPost: 2,         // moderator+
  manageResources: 2,  // moderator+
  flagContent: 2,      // moderator+
  flagMember: 2,       // moderator+
};

/**
 * Roles whose permission set is an AUTHORITATIVE whitelist — the role gets
 * EXACTLY these permissions and nothing else, bypassing the numeric hierarchy.
 * Steward shares numeric level 2 with moderator, but `kickMember`/`banUser` are
 * also level 2; a numeric fallthrough would leak them. The whitelist denies
 * anything not listed, so a steward can moderate the discussion board and flag,
 * but can never kick/ban members or manage roles/resources.
 */
const ROLE_CAPABILITIES: Record<string, ReadonlySet<string>> = {
  steward: new Set(['deletePost', 'pinPost', 'lockPost', 'flagContent', 'flagMember']),
};

/** Check if a role has a specific permission */
export function hasPermission(role: string, permission: string): boolean {
  const caps = ROLE_CAPABILITIES[role];
  if (caps) return caps.has(permission);
  const roleLevel = ROLE_HIERARCHY[role] ?? 0;
  const requiredLevel = PERMISSION_MAP[permission] ?? Infinity;
  return roleLevel >= requiredLevel;
}

/** Check if actorRole can manage targetRole */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actorLevel = ROLE_HIERARCHY[actorRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 0;
  return actorLevel > targetLevel;
}
