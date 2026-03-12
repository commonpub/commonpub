# Drizzle + SvelteKit Integration

## Connection Pooling

Create `pg.Pool` once at module level in `hooks.server.ts`. SvelteKit reuses the module across requests in dev and production.

```typescript
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@commonpub/schema';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool, { schema });
```

Attach to `event.locals.db` so all server load functions and actions share the pool.

## Query Patterns for SSR

### Reads in `+page.server.ts` load functions

```typescript
export async function load({ locals }) {
  const items = await locals.db
    .select()
    .from(contentItems)
    .where(eq(contentItems.status, 'published'))
    .orderBy(desc(contentItems.publishedAt))
    .limit(20);
  return { items };
}
```

### Mutations in form actions

```typescript
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData();
    const [item] = await locals.db
      .insert(contentItems)
      .values({ ... })
      .returning();
    redirect(303, `/${item.type}/${item.slug}`);
  }
};
```

## Transaction Handling

Use `db.transaction()` for multi-table mutations:

```typescript
await locals.db.transaction(async (tx) => {
  const [item] = await tx.insert(contentItems).values({ ... }).returning();
  if (tagIds.length) {
    await tx.insert(contentTags).values(tagIds.map(tagId => ({ contentId: item.id, tagId })));
  }
});
```

## Conclusion

- Single `pg.Pool` in hooks, shared via `locals.db`
- Drizzle query builder for all reads/writes (no raw SQL)
- Transactions for multi-table mutations (content + tags)
- Connection string from `env.DATABASE_URL`
