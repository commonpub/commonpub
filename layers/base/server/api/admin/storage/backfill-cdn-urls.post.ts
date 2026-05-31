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
import { contentItems, contests, files, hubs, learningPaths, products, users } from '@commonpub/schema';
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
  requirePermission(event, 'storage.manage');

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

  // Every LOCAL column that the upload pipeline writes a Spaces public
  // URL into (avatar/banner/icon/cover/banner/contest-banner/product-
  // image + files + learning cover). Federation tables hold REMOTE
  // URLs and are deliberately excluded so we never rewrite another host.
  const n = async <T>(q: Promise<{ n: number }[]>): Promise<number> => (await q)[0]?.n ?? 0;

  const counts = {
    'files.publicUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(files).where(sql`${files.publicUrl} LIKE ${like}`)),
    'contentItems.coverImageUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(contentItems).where(sql`${contentItems.coverImageUrl} LIKE ${like}`)),
    'contentItems.bannerUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(contentItems).where(sql`${contentItems.bannerUrl} LIKE ${like}`)),
    'learningPaths.coverImageUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(learningPaths).where(sql`${learningPaths.coverImageUrl} LIKE ${like}`)),
    'users.avatarUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(users).where(sql`${users.avatarUrl} LIKE ${like}`)),
    'users.bannerUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(users).where(sql`${users.bannerUrl} LIKE ${like}`)),
    'hubs.iconUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(hubs).where(sql`${hubs.iconUrl} LIKE ${like}`)),
    'hubs.bannerUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(hubs).where(sql`${hubs.bannerUrl} LIKE ${like}`)),
    'contests.bannerUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(contests).where(sql`${contests.bannerUrl} LIKE ${like}`)),
    'products.imageUrl': await n(db.select({ n: sql<number>`count(*)::int` }).from(products).where(sql`${products.imageUrl} LIKE ${like}`)),
  };

  if (dryRun) {
    return { success: true, dryRun: true, hosts, wouldRewrite: counts };
  }

  await db.update(files).set({ publicUrl: sql`replace(${files.publicUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${files.publicUrl} LIKE ${like}`);
  await db.update(contentItems).set({ coverImageUrl: sql`replace(${contentItems.coverImageUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${contentItems.coverImageUrl} LIKE ${like}`);
  await db.update(contentItems).set({ bannerUrl: sql`replace(${contentItems.bannerUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${contentItems.bannerUrl} LIKE ${like}`);
  await db.update(learningPaths).set({ coverImageUrl: sql`replace(${learningPaths.coverImageUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${learningPaths.coverImageUrl} LIKE ${like}`);
  await db.update(users).set({ avatarUrl: sql`replace(${users.avatarUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${users.avatarUrl} LIKE ${like}`);
  await db.update(users).set({ bannerUrl: sql`replace(${users.bannerUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${users.bannerUrl} LIKE ${like}`);
  await db.update(hubs).set({ iconUrl: sql`replace(${hubs.iconUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${hubs.iconUrl} LIKE ${like}`);
  await db.update(hubs).set({ bannerUrl: sql`replace(${hubs.bannerUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${hubs.bannerUrl} LIKE ${like}`);
  await db.update(contests).set({ bannerUrl: sql`replace(${contests.bannerUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${contests.bannerUrl} LIKE ${like}`);
  await db.update(products).set({ imageUrl: sql`replace(${products.imageUrl}, ${hosts.origin}, ${hosts.cdn})` }).where(sql`${products.imageUrl} LIKE ${like}`);

  return { success: true, dryRun: false, hosts, rewritten: counts };
});
