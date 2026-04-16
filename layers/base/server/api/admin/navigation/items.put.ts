import type { NavItem } from '@commonpub/server';
import { setNavItems } from '@commonpub/server';
import { z } from 'zod';

const navItemSchema: z.ZodType<NavItem> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(64),
    type: z.enum(['link', 'dropdown', 'external']),
    label: z.string().min(1).max(128),
    icon: z.string().max(128).optional(),
    route: z.string().max(255).optional(),
    href: z.string().url().max(1024).optional(),
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
  const user = requireAdmin(event);
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
