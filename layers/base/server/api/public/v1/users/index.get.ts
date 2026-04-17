import { isPublicUser, toPublicUser, type PublicUserRow } from '@commonpub/server';
import { users } from '@commonpub/schema';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const PUBLIC_FIELDS = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  headline: users.headline,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  bannerUrl: users.bannerUrl,
  pronouns: users.pronouns,
  location: users.location,
  website: users.website,
  skills: users.skills,
  socialLinks: users.socialLinks,
  profileVisibility: users.profileVisibility,
  createdAt: users.createdAt,
  deletedAt: users.deletedAt,
};

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:users');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const { q, limit, offset } = parsed.data;

  const db = useDB();
  const conds = [
    isNull(users.deletedAt),
    eq(users.profileVisibility, 'public'),
    eq(users.status, 'active'),
  ];
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(users.username, pattern), ilike(users.displayName, pattern))!);
  }

  const [rows, totalRow] = await Promise.all([
    db.select(PUBLIC_FIELDS).from(users).where(and(...conds)).orderBy(desc(users.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(...conds)),
  ]);

  const items = rows
    .filter((r) => isPublicUser(r as PublicUserRow))
    .map((r) => toPublicUser(r as PublicUserRow));
  const total = totalRow[0]?.count ?? 0;

  return { items, total, limit, offset };
});
