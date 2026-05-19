/**
 * Admin maintenance: rewrite stored DigitalOcean Spaces ORIGIN asset
 * URLs to the CDN edge host.
 *
 * POST /api/admin/storage/backfill-cdn-urls        (apply)
 * POST /api/admin/storage/backfill-cdn-urls?dryRun=1  (counts only)
 *
 * WHY: object public URLs are frozen into the DB at upload time
 * (files.public_url, content_items.cover_image_url,
 * learning_paths.cover_image_url). Enabling S3_CDN only affects NEW
 * uploads — existing rows keep the origin host until rewritten. This
 * is the admin-UI equivalent of a one-off backfill, idempotent
 * (re-running once rewritten is a no-op).
 *
 * Requires admin. Derives the origin→CDN host pair from the instance's
 * own S3 env, so it can only ever rewrite THIS instance's Spaces host.
 */
import { contentItems, files, learningPaths } from '@commonpub/schema';
import { sql } from 'drizzle-orm';

function spacesHosts(): { origin: string; cdn: string } | null {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT ?? '';
  const region = process.env.S3_REGION;
  if (!bucket) return null;
  const m = endpoint.match(/^https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com\/?$/i);
  if (!m) return null;
  const reg = region || m[1]!;
  return {
    origin: `${bucket}.${reg}.digitaloceanspaces.com`,
    cdn: `${bucket}.${reg}.cdn.digitaloceanspaces.com`,
  };
}

export default defineEventHandler(async (event) => {
  requireAuth(event);
  requireAdmin(event);

  const hosts = spacesHosts();
  if (!hosts) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'This instance is not configured for DigitalOcean Spaces (need S3_BUCKET + a *.digitaloceanspaces.com S3_ENDPOINT).',
    });
  }
  // Guard against a no-op host pair.
  if (hosts.origin === hosts.cdn) {
    throw createError({ statusCode: 400, statusMessage: 'Origin and CDN host are identical.' });
  }

  const dryRun = getQuery(event).dryRun === '1';
  const db = useDB();
  const like = `%${hosts.origin}%`;

  // Count rows still on the origin host (the `.cdn.` host does NOT match
  // because the literal `.digitaloceanspaces.com` origin substring is
  // absent once rewritten — so this is also the idempotency check).
  const [fc] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(files)
    .where(sql`${files.publicUrl} LIKE ${like}`);
  const [cc] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contentItems)
    .where(sql`${contentItems.coverImageUrl} LIKE ${like}`);
  const [lc] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(learningPaths)
    .where(sql`${learningPaths.coverImageUrl} LIKE ${like}`);

  const counts = {
    files: fc?.n ?? 0,
    contentItems: cc?.n ?? 0,
    learningPaths: lc?.n ?? 0,
  };

  if (dryRun) {
    return { success: true, dryRun: true, hosts, wouldRewrite: counts };
  }

  await db
    .update(files)
    .set({ publicUrl: sql`replace(${files.publicUrl}, ${hosts.origin}, ${hosts.cdn})` })
    .where(sql`${files.publicUrl} LIKE ${like}`);
  await db
    .update(contentItems)
    .set({ coverImageUrl: sql`replace(${contentItems.coverImageUrl}, ${hosts.origin}, ${hosts.cdn})` })
    .where(sql`${contentItems.coverImageUrl} LIKE ${like}`);
  await db
    .update(learningPaths)
    .set({ coverImageUrl: sql`replace(${learningPaths.coverImageUrl}, ${hosts.origin}, ${hosts.cdn})` })
    .where(sql`${learningPaths.coverImageUrl} LIKE ${like}`);

  return { success: true, dryRun: false, hosts, rewritten: counts };
});
