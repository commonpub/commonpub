import type { PublicInstance } from '@commonpub/server';
import { contentItems, hubs, users } from '@commonpub/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:instance');
  const db = useDB();
  const config = useConfig();

  // Cheap aggregate counts. If these become hot we can swap to a cached
  // materialized view — but at commonpub/deveco volume a per-request count
  // is fine.
  const [[userStats], [contentStats], [hubStats]] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      activeMonth: sql<number>`count(*) FILTER (WHERE ${users.createdAt} > NOW() - INTERVAL '30 days')::int`,
    }).from(users).where(and(isNull(users.deletedAt), eq(users.status, 'active'))),
    db.select({ total: sql<number>`count(*)::int` })
      .from(contentItems)
      .where(and(eq(contentItems.status, 'published'), isNull(contentItems.deletedAt))),
    db.select({ total: sql<number>`count(*)::int` })
      .from(hubs)
      .where(isNull(hubs.deletedAt)),
  ]);

  const domain = config.instance.domain;
  const features = config.features as unknown as Record<string, boolean>;

  const response: PublicInstance = {
    name: config.instance.name,
    description: config.instance.description ?? null,
    domain,
    software: {
      name: 'commonpub',
      version: '1.0.0',
    },
    users: {
      total: userStats?.total ?? 0,
      activeMonth: userStats?.activeMonth ?? 0,
    },
    content: { total: contentStats?.total ?? 0 },
    hubs: { total: hubStats?.total ?? 0 },
    features: {
      content: !!features.content,
      hubs: !!features.hubs,
      docs: !!features.docs,
      video: !!features.video,
      contests: !!features.contests,
      events: !!features.events,
      learning: !!features.learning,
      explainers: !!features.explainers,
      federation: !!features.federation,
    },
    openRegistrations: !!config.auth?.emailPassword,
    links: {
      nodeinfo: `https://${domain}/nodeinfo/2.1`,
      webfinger: `https://${domain}/.well-known/webfinger`,
      api: `https://${domain}/api/public/v1`,
    },
  };
  return response;
});
