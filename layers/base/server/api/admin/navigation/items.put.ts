import type { NavItem } from '@commonpub/server';
import { setNavItems } from '@commonpub/server';
import { z } from 'zod';

// A nav `href` is an EXTERNAL link target: http(s) plus the contact schemes an
// operator legitimately uses (mailto:/tel:), but never a script-executing scheme.
// (Internal destinations use `route`, not `href`.) An http(s)-only allowlist here
// would reject a pre-existing mailto: item and, since the nav PUT is all-or-nothing,
// brick every save — so this is a targeted dangerous-scheme denylist.
const navHref = z
  .string()
  .max(1024)
  .refine((u) => /^(https?:|mailto:|tel:)/i.test(u.trim()), {
    message: 'External link must be an http(s), mailto:, or tel: URL',
  })
  .optional();

const navItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    type: z.enum(['link', 'dropdown', 'external']),
    label: z.string().min(1).max(128),
    icon: z.string().max(128).optional(),
    route: z.string().max(255).optional(),
    href: navHref,
    featureGate: z.string().max(64).optional(),
    children: z.array(navItemSchema).max(20).optional(),
    visibleTo: z.enum(['all', 'authenticated', 'admin']).optional(),
    disabled: z.boolean().optional(),
  }),
) as z.ZodType<NavItem>;

const updateNavSchema = z.object({
  items: z.array(navItemSchema).min(1).max(30),
});

/**
 * PUT /api/admin/navigation/items
 * Save navigation item configuration.
 */
export default defineEventHandler(async (event) => {
  const user = requirePermission(event, 'navigation.manage');
  const db = useDB();
  const body = await parseBody(event, updateNavSchema);

  // Validate unique IDs (flatten to check children too)
  const ids = new Set<string>();
  function collectIds(items: NavItem[]): void {
    for (const item of items) {
      if (ids.has(item.id)) {
        throw createError({ statusCode: 400, statusMessage: `Duplicate nav item ID: ${item.id}` });
      }
      ids.add(item.id);
      if (item.children) {
        collectIds(item.children);
      }
    }
  }
  collectIds(body.items);

  await setNavItems(db, body.items, user.id, getRequestIP(event) ?? undefined);

  return { items: body.items, message: 'Navigation updated' };
});
