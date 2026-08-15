import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { disclosureEvents } from '../persona.js';
import { apiKeys } from '../publicApi.js';
import {
  PUBLIC_API_SCOPES,
  WILDCARD_PROTECTED_SCOPES,
  createApiKeySchema,
} from '../validators/publicApi.js';

/**
 * Migration 0047: the opt-in member visibility directory's storage.
 *
 * These assertions are the ones a later change would have to delete on purpose,
 * because each of them is a decision from `docs/plans/member-visibility-directory.md`
 * section 3 that is invisible in the generated SQL diff once it has shipped.
 */

const disclosureConfig = getTableConfig(disclosureEvents);
const apiKeysConfig = getTableConfig(apiKeys);

describe('disclosure_events table', () => {
  it('is named disclosure_events', () => {
    expect(disclosureConfig.name).toBe('disclosure_events');
  });

  it('has exactly the seven planned columns', () => {
    expect(disclosureConfig.columns.map((c) => c.name).sort()).toEqual([
      'api_key_id',
      'disclosed_at',
      'id',
      'purpose',
      'recipient_id',
      'scope_digest',
      'user_id',
    ]);
  });

  it('requires a recipient, a member, a purpose and a digest on every row', () => {
    // An unattributed disclosure, or one that cannot prove which grant
    // authorised it, is exactly the row that makes the audit worthless.
    for (const name of ['recipient_id', 'user_id', 'purpose', 'scope_digest', 'disclosed_at']) {
      const col = disclosureConfig.columns.find((c) => c.name === name);
      expect(col, name).toBeDefined();
      expect(col?.notNull, name).toBe(true);
    }
  });

  it('caps purpose at 24 and scope_digest at 16, matching user_purpose_consents', () => {
    const purpose = disclosureConfig.columns.find((c) => c.name === 'purpose');
    const digest = disclosureConfig.columns.find((c) => c.name === 'scope_digest');
    const recipient = disclosureConfig.columns.find((c) => c.name === 'recipient_id');
    expect((purpose as unknown as { length?: number }).length).toBe(24);
    expect((digest as unknown as { length?: number }).length).toBe(16);
    expect((recipient as unknown as { length?: number }).length).toBe(40);
  });

  it('allows a null api_key_id so a deleted key does not erase its history', () => {
    const col = disclosureConfig.columns.find((c) => c.name === 'api_key_id');
    expect(col?.notNull).toBe(false);
  });

  it('cascades from users and sets null from api_keys', () => {
    const byColumn = new Map(
      disclosureConfig.foreignKeys.map((fk) => [fk.reference().columns[0]?.name, fk]),
    );
    // Erasure removes the member's disclosure rows...
    expect(byColumn.get('user_id')?.onDelete).toBe('cascade');
    expect(byColumn.get('user_id')?.reference().foreignColumns[0]?.name).toBe('id');
    // ...but revoking or deleting a key must not erase the record that it read
    // somebody, so the history stays attributable to the recipient.
    expect(byColumn.get('api_key_id')?.onDelete).toBe('set null');
  });

  it('indexes both read paths: "who saw me" and the per-recipient operator view', () => {
    const indexes = disclosureConfig.indexes.map((i) => ({
      name: i.config.name,
      columns: (i.config.columns as ReadonlyArray<{ name?: string }>).map((c) => c.name),
      unique: i.config.unique,
    }));
    expect(indexes).toContainEqual({
      name: 'idx_disclosure_user_time',
      columns: ['user_id', 'disclosed_at'],
      unique: false,
    });
    expect(indexes).toContainEqual({
      name: 'idx_disclosure_recipient_time',
      columns: ['recipient_id', 'disclosed_at'],
      unique: false,
    });
  });

  it('has NO unique constraint on (recipient, user): a repeat pull is a repeat disclosure', () => {
    // The count is the signal that makes bulk extraction visible. Deduplicating
    // here would silently turn "Acme looked at you 40 times" into "Acme looked".
    expect(disclosureConfig.indexes.filter((i) => i.config.unique)).toHaveLength(0);
    expect(disclosureConfig.uniqueConstraints).toHaveLength(0);
  });
});

describe('api_keys.recipient_id', () => {
  it('exists and is nullable, so every key already in the field is unaffected', () => {
    const col = apiKeysConfig.columns.find((c) => c.name === 'recipient_id');
    expect(col).toBeDefined();
    expect(col?.notNull).toBe(false);
    expect(col?.hasDefault).toBe(false);
    expect((col as unknown as { length?: number }).length).toBe(40);
  });

  it('is not a foreign key: recipients are config/DB data, not a table', () => {
    const fkColumns = apiKeysConfig.foreignKeys.flatMap((fk) =>
      fk.reference().columns.map((c) => c.name),
    );
    expect(fkColumns).not.toContain('recipient_id');
  });
});

describe('read:members scope', () => {
  it('is a known public API scope, accepted with a recipient binding', () => {
    expect(PUBLIC_API_SCOPES as readonly string[]).toContain('read:members');
    expect(
      createApiKeySchema.safeParse({
        name: 'k',
        scopes: ['read:members'],
        recipientId: 'acme-robotics',
      }).success,
    ).toBe(true);
  });

  it('refuses a read:members key with no recipient, because it could read nothing', () => {
    // The directory 403s a key whose `recipient_id` resolves to nobody, so a key
    // created without one is a dead token that looks healthy in the admin list
    // forever. Refusing it in the schema closes the paths that do not go through
    // the admin form: curl, a fork's own UI, a migration script.
    const result = createApiKeySchema.safeParse({ name: 'k', scopes: ['read:members'] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.recipientId?.[0]).toMatch(/name the recipient/i);
    }
  });

  it('leaves every other scope free of the binding requirement', () => {
    // The refine is scoped to `read:members`. A content key that suddenly needed
    // a recipient would break every existing admin form submission.
    expect(createApiKeySchema.safeParse({ name: 'k', scopes: ['read:content'] }).success).toBe(true);
    expect(createApiKeySchema.safeParse({ name: 'k', scopes: ['read:*'] }).success).toBe(true);
  });

  it('validates the recipient id against the varchar(40) alphabet', () => {
    const bad = ['Acme Robotics', 'a'.repeat(41), 'ACME', 'acme.robotics', ''];
    for (const recipientId of bad) {
      expect(
        createApiKeySchema.safeParse({ name: 'k', scopes: ['read:members'], recipientId }).success,
        `${JSON.stringify(recipientId)} must be refused`,
      ).toBe(false);
    }
    expect(
      createApiKeySchema.safeParse({
        name: 'k',
        scopes: ['read:members'],
        recipientId: 'a'.repeat(40),
      }).success,
    ).toBe(true);
  });

  it('is wildcard-protected, so read:* does not grant it', () => {
    // The only scope that returns identified people. A key issued for content
    // metrics must not pick it up because a later release shipped it.
    expect(WILDCARD_PROTECTED_SCOPES).toContain('read:members');
  });

  it('keeps every wildcard-protected entry inside the scope tuple', () => {
    expect(WILDCARD_PROTECTED_SCOPES.length).toBeGreaterThanOrEqual(2);
    for (const scope of WILDCARD_PROTECTED_SCOPES) {
      expect(PUBLIC_API_SCOPES as readonly string[]).toContain(scope);
    }
  });
});

describe('migration 0047 SQL', () => {
  const migrationsDir = new URL('../../migrations/', import.meta.url).pathname;
  const files = readdirSync(migrationsDir).filter((f) => f.startsWith('0047_') && f.endsWith('.sql'));

  it('walked exactly one 0047 migration file', () => {
    // Guard the guard: a wrong path reads zero files and everything below is
    // vacuously green.
    expect(files).toHaveLength(1);
  });

  it('touches exactly one pre-existing table, with one nullable ADD COLUMN', () => {
    const sql = readFileSync(join(migrationsDir, files[0] as string), 'utf8');
    expect(sql.length).toBeGreaterThan(0);

    const alters = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('ALTER TABLE'));
    expect(alters.length).toBeGreaterThan(0);

    const onExistingTables = alters.filter((s) => !s.includes('"disclosure_events"'));
    expect(onExistingTables).toEqual(['ALTER TABLE "api_keys" ADD COLUMN "recipient_id" varchar(40);']);
    // Nullable and without a default: no table rewrite, no backfill, no
    // behaviour change for a key that predates the directory.
    expect(onExistingTables[0]).not.toMatch(/NOT NULL|DEFAULT/i);
  });

  it('creates disclosure_events with both indexes', () => {
    const sql = readFileSync(join(migrationsDir, files[0] as string), 'utf8');
    expect(sql).toContain('CREATE TABLE "disclosure_events"');
    expect(sql).toContain('idx_disclosure_user_time');
    expect(sql).toContain('idx_disclosure_recipient_time');
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX[^;]*disclosure/i);
    expect(sql).not.toContain('DROP');
  });
});
