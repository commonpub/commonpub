import { eq, and, isNull } from 'drizzle-orm';
import { federatedContent } from '@commonpub/schema';

/**
 * POST /api/admin/federation/repair-types
 * Re-fetches source objects for federated content with missing cpubType
 * and updates them based on the cpub:type extension field.
 */
export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();

  const rows = await db
    .select({
      id: federatedContent.id,
      objectUri: federatedContent.objectUri,
    })
    .from(federatedContent)
    .where(and(
      isNull(federatedContent.cpubType),
      isNull(federatedContent.deletedAt),
    ))
    .limit(500);

  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(row.objectUri, {
        headers: { Accept: 'application/activity+json, application/ld+json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) { errors++; continue; }

      const object = await response.json() as Record<string, unknown>;
      const cpubType = typeof object['cpub:type'] === 'string' ? object['cpub:type'] : null;

      if (cpubType) {
        await db
          .update(federatedContent)
          .set({ cpubType, updatedAt: new Date() })
          .where(eq(federatedContent.id, row.id));
        updated++;
      }
    } catch {
      errors++;
    }
  }

  return { total: rows.length, updated, errors };
});
