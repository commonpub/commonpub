import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, and, desc } from 'drizzle-orm';
import { users, activities } from '@commonpub/schema';
import { generateOutboxCollection, generateOutboxPage, type APActivity } from '@commonpub/protocol';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  if (!locals.config.features.federation) {
    error(404, 'Federation is not enabled');
  }

  const rows = await locals.db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, params.username))
    .limit(1);

  if (rows.length === 0) {
    error(404, 'User not found');
  }

  const domain = locals.config.instance.domain;
  const actorUri = `https://${domain}/users/${params.username}`;
  const page = url.searchParams.get('page');
  const pageSize = 20;

  if (!page) {
    // Return collection summary
    const countResult = await locals.db
      .select({ count: activities.id })
      .from(activities)
      .where(and(eq(activities.actorUri, actorUri), eq(activities.direction, 'outbound')));
    const totalItems = countResult.length;
    const collection = generateOutboxCollection(totalItems, domain, params.username);
    return json(collection, {
      headers: { 'Content-Type': 'application/activity+json' },
    });
  }

  // Return page
  const pageNum = parseInt(page, 10) || 1;
  const offset = (pageNum - 1) * pageSize;

  const rows2 = await locals.db
    .select()
    .from(activities)
    .where(and(eq(activities.actorUri, actorUri), eq(activities.direction, 'outbound')))
    .orderBy(desc(activities.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalItems = rows2.length; // Simplified — could do COUNT(*)
  const activityPayloads = rows2.map((r) => r.payload as APActivity);
  const collectionPage = generateOutboxPage(
    activityPayloads,
    domain,
    params.username,
    pageNum,
    pageSize,
    totalItems,
  );

  return json(collectionPage, {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};
