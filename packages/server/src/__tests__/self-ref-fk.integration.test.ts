/**
 * Verifies the self-referential FKs added in migration 0013 behave as ON DELETE SET NULL:
 * deleting a parent row promotes its children to top-level (parentId → NULL) rather than
 * cascading the delete or orphaning a dangling pointer. pushSchema applies the FK from the
 * Drizzle `.references()` definitions, so PGlite enforces it here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments } from '@commonpub/schema';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';

describe('self-referential FK ON DELETE SET NULL', () => {
  let db: DB;
  let authorId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const user = await createTestUser(db, { username: 'fkuser' });
    authorId = user.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('nulls a child comment.parent_id when the parent comment is deleted (no cascade, no dangling)', async () => {
    const targetId = '00000000-0000-0000-0000-0000000000aa';
    const [parent] = await db
      .insert(comments)
      .values({ authorId, targetType: 'project', targetId, content: 'parent' })
      .returning();
    const [child] = await db
      .insert(comments)
      .values({ authorId, targetType: 'project', targetId, content: 'child', parentId: parent!.id })
      .returning();

    // Delete the parent — the FK should set the child's parentId to NULL, not delete it.
    await db.delete(comments).where(eq(comments.id, parent!.id));

    const [stillThere] = await db.select().from(comments).where(eq(comments.id, child!.id));
    expect(stillThere).toBeDefined(); // child survives (not cascaded)
    expect(stillThere!.parentId).toBeNull(); // promoted to top-level
  });

  it('accepts a valid parent reference (FK does not reject legitimate nesting)', async () => {
    const targetId = '00000000-0000-0000-0000-0000000000bb';
    const [p] = await db
      .insert(comments)
      .values({ authorId, targetType: 'project', targetId, content: 'p' })
      .returning();
    await expect(
      db.insert(comments).values({ authorId, targetType: 'project', targetId, content: 'c', parentId: p!.id }).returning(),
    ).resolves.toBeDefined();
  });
});
