/**
 * Integration tests for recipient resolution (member-visibility plan section 3,
 * persona plan 5.3).
 *
 * These run against a real (PGlite) database through the real
 * `instance_settings` and `audit_logs` tables, and through the real
 * `dataRecipientSchema`. Four things are being protected:
 *
 * UNION PRECEDENCE. `dataSharing.recipients` is a UNION of the config file and
 * the database, deduped by id with the FILE winning, on the
 * `auth.trustedInstances` precedent. Choosing the other semantics (whole-document
 * override, or DB-wins) fails no compiler and no other test, so it is asserted
 * directly here, including the case that distinguishes them: the same id in both
 * sources with a DIFFERENT relationship.
 *
 * THE SANITIZER. Everything read out of the database is re-parsed with the same
 * schema the write path uses, and anything failing it is dropped. That schema is
 * what refuses a recipient with no privacy policy and what refuses an unpapered
 * joint controller, so a row written around this module (through the generic
 * settings route, or by an older release) must not become a disclosure target.
 *
 * KEY BINDING. A key with no `recipient_id`, a blank one, or one naming a
 * recipient that no longer exists all resolve to `null`, which is what the route
 * turns into a 403. Deleting a recipient has to stop its key immediately.
 *
 * THE DIGEST. Adding a recipient in the DATABASE must move the scope digest,
 * because a recipient the member was never shown must not be disclosed to on a
 * grant given before it existed. That only happens if a caller passes
 * `effectiveDataSharingDocument` as the `PurposeScopeResolvers.dataSharing`
 * resolver, so the difference is asserted rather than assumed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { auditLogs, instanceSettings } from '@commonpub/schema';
import type { DataRecipient } from '@commonpub/persona';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  DATA_SHARING_RECIPIENTS_SETTING_KEY,
  MAX_STORED_RECIPIENTS,
  RECIPIENT_AUDIT_ACTIONS,
  clearStoredRecipients,
  effectiveDataSharingDocument,
  effectiveRecipients,
  getStoredRecipients,
  recipientCoversPurpose,
  recipientsFromConfig,
  resolveKeyRecipient,
  sanitizeStoredRecipients,
  setStoredRecipients,
} from '../persona/recipients.js';
import { currentPurposeScope } from '../persona/consent.js';

function recipient(overrides: Partial<DataRecipient> = {}): DataRecipient {
  return {
    id: 'acme',
    name: 'Acme Robotics',
    privacyPolicyUrl: 'https://acme.example/privacy',
    purposes: ['recruiter_visibility'],
    relationship: 'processor',
    ...overrides,
  };
}

/** A config shaped like the slice these functions read. */
function cfg(recipients?: DataRecipient[]): { dataSharing?: unknown } {
  return recipients === undefined ? {} : { dataSharing: { recipients } };
}

describe('data sharing recipients: union, sanitizer, key binding', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    adminId = (await createTestUser(db, { username: 'recipients-admin', role: 'admin' })).id;
  });
  afterAll(async () => {
    await closeTestDB(db);
  });

  beforeEach(async () => {
    await db.delete(instanceSettings);
    await db.delete(auditLogs);
  });

  // --- The union ----------------------------------------------------------------

  describe('effectiveRecipients', () => {
    it('is empty when neither source declares anything', async () => {
      expect(await effectiveRecipients(db, cfg())).toEqual([]);
    });

    it('returns the config file alone when nothing is stored', async () => {
      const list = await effectiveRecipients(db, cfg([recipient()]));
      expect(list.map((r) => r.id)).toEqual(['acme']);
    });

    it('returns a stored recipient the file does not declare (this is a UNION)', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind', name: 'Northwind' })]);
      const list = await effectiveRecipients(db, cfg([recipient()]));
      expect(list.map((r) => r.id)).toEqual(['acme', 'northwind']);
    });

    it('lets the FILE win a collision on id', async () => {
      // The case that separates union-file-wins from every other semantics: the
      // same id in both sources, differing in the field that decides whether an
      // onward transfer is papered. An admin screen must not be able to
      // redefine what git says about a recipient.
      await setStoredRecipients(db, adminId, [
        recipient({ name: 'Acme (edited in the portal)', relationship: 'processor' }),
      ]);
      const list = await effectiveRecipients(db, cfg([
        recipient({ name: 'Acme Robotics', relationship: 'joint_controller', agreementRef: 'DPA-1' }),
      ]));
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('Acme Robotics');
      expect(list[0]?.relationship).toBe('joint_controller');
    });

    it('dedupes a config file that declares the same id twice, keeping the first', () => {
      const list = recipientsFromConfig({
        dataSharing: { recipients: [recipient({ name: 'First' }), recipient({ name: 'Second' })] },
      });
      expect(list).toHaveLength(1);
      expect(list[0]?.name).toBe('First');
    });

    it('yields NO recipients from a malformed config document', () => {
      // Fail closed: no recipients means no purpose requiring one is offerable,
      // means nothing is collected and nothing is disclosed. A config typo must
      // never be able to turn a disclosure on.
      expect(recipientsFromConfig({ dataSharing: { recipients: 'not-an-array' } })).toEqual([]);
      expect(recipientsFromConfig({ dataSharing: 42 })).toEqual([]);
      expect(recipientsFromConfig({})).toEqual([]);
    });

    it('orders the union file-first, then the stored entries', async () => {
      await setStoredRecipients(db, adminId, [
        recipient({ id: 'zeta' }),
        recipient({ id: 'alpha' }),
      ]);
      const list = await effectiveRecipients(db, cfg([recipient({ id: 'file-one' })]));
      expect(list.map((r) => r.id)).toEqual(['file-one', 'zeta', 'alpha']);
    });
  });

  // --- The sanitizer ------------------------------------------------------------

  describe('sanitizeStoredRecipients', () => {
    it('drops an entry with no privacy policy URL and keeps the rest', () => {
      const kept = sanitizeStoredRecipients([
        { id: 'nopolicy', name: 'No Policy', purposes: ['sponsor_sharing'], relationship: 'processor' },
        recipient({ id: 'good' }),
      ]);
      expect(kept.map((r) => r.id)).toEqual(['good']);
    });

    it('drops an unpapered joint controller, which is the refusal that matters most', () => {
      // `dataRecipientSchema.refine` is what stands between this feature and an
      // undocumented onward transfer. A row that got past it (older release,
      // generic settings route) must not become a disclosure target on read.
      const kept = sanitizeStoredRecipients([
        recipient({ id: 'unpapered', relationship: 'joint_controller' }),
        recipient({ id: 'papered', relationship: 'joint_controller', agreementRef: 'DPA-9' }),
      ]);
      expect(kept.map((r) => r.id)).toEqual(['papered']);
    });

    it.each<[string, unknown]>([
      ['a non-array scalar', 'nonsense'],
      ['null', null],
      ['a number', 7],
    ])('returns an empty list for %s', (_label, raw) => {
      expect(sanitizeStoredRecipients(raw)).toEqual([]);
    });

    it('accepts the { recipients: [...] } wrapper as well as a bare array', () => {
      expect(sanitizeStoredRecipients({ recipients: [recipient()] }).map((r) => r.id)).toEqual([
        'acme',
      ]);
    });

    it('drops an entry carrying unknown keys, because the schema is strict', () => {
      expect(sanitizeStoredRecipients([{ ...recipient(), sneaky: 'value' }])).toEqual([]);
    });

    it('caps what it will read back at the stored maximum', () => {
      const many = Array.from({ length: MAX_STORED_RECIPIENTS + 10 }, (_v, i) =>
        recipient({ id: `r${i}` }),
      );
      expect(sanitizeStoredRecipients(many)).toHaveLength(MAX_STORED_RECIPIENTS);
    });

    it('falls back to no stored recipients when the row was written as junk', async () => {
      // Written around this module, the way `theme.token_overrides` gets written.
      await db
        .insert(instanceSettings)
        .values({ key: DATA_SHARING_RECIPIENTS_SETTING_KEY, value: { nope: true } });
      expect(await getStoredRecipients(db)).toEqual([]);
      expect(await effectiveRecipients(db, cfg([recipient()]))).toHaveLength(1);
    });
  });

  // --- Key binding --------------------------------------------------------------

  describe('resolveKeyRecipient', () => {
    it('resolves a key bound to a file-declared recipient', async () => {
      const found = await resolveKeyRecipient(db, cfg([recipient()]), { recipientId: 'acme' });
      expect(found?.id).toBe('acme');
    });

    it('resolves a key bound to a database-declared recipient', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      const found = await resolveKeyRecipient(db, cfg(), { recipientId: 'northwind' });
      expect(found?.id).toBe('northwind');
    });

    it.each<[string, string | null | undefined]>([
      ['no binding at all', null],
      ['an undefined binding', undefined],
      ['a blank binding', '   '],
      ['a binding nothing declares', 'ghost'],
    ])('resolves to null for %s', async (_label, recipientId) => {
      const found = await resolveKeyRecipient(db, cfg([recipient()]), { recipientId });
      expect(found).toBeNull();
    });

    it('stops resolving the moment the recipient is removed from both sources', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      expect(await resolveKeyRecipient(db, cfg(), { recipientId: 'northwind' })).not.toBeNull();

      // Withdrawing the recipient withdraws the disclosure. Revoking the key is
      // then cleanup, not the control.
      await setStoredRecipients(db, adminId, []);
      expect(await resolveKeyRecipient(db, cfg(), { recipientId: 'northwind' })).toBeNull();
    });

    it('never matches on a prefix or a case-folded id', async () => {
      const config = cfg([recipient({ id: 'acme' })]);
      expect(await resolveKeyRecipient(db, config, { recipientId: 'acm' })).toBeNull();
      expect(await resolveKeyRecipient(db, config, { recipientId: 'ACME' })).toBeNull();
      expect(await resolveKeyRecipient(db, config, { recipientId: 'acme2' })).toBeNull();
    });
  });

  describe('recipientCoversPurpose', () => {
    it('is true only for a purpose the recipient declares', () => {
      const r = recipient({ purposes: ['recruiter_visibility'] });
      expect(recipientCoversPurpose(r, 'recruiter_visibility')).toBe(true);
      expect(recipientCoversPurpose(r, 'sponsor_sharing')).toBe(false);
      expect(recipientCoversPurpose(r, 'profile_analytics')).toBe(false);
    });

    it('is true for each of several declared purposes', () => {
      const r = recipient({ purposes: ['recruiter_visibility', 'sponsor_sharing'] });
      expect(recipientCoversPurpose(r, 'recruiter_visibility')).toBe(true);
      expect(recipientCoversPurpose(r, 'sponsor_sharing')).toBe(true);
    });
  });

  // --- Writing ------------------------------------------------------------------

  describe('setStoredRecipients', () => {
    it('stores a valid list and reads it back through the sanitizer', async () => {
      const result = await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      expect(result.ok).toBe(true);
      expect(await getStoredRecipients(db)).toHaveLength(1);
    });

    it('refuses the WHOLE list when one entry is invalid, naming the index', async () => {
      // All or nothing on write: a partial save leaves the instance disclosing
      // to a recipient the operator believes they removed.
      const result = await setStoredRecipients(db, adminId, [
        recipient({ id: 'good' }),
        { id: 'bad', name: 'Bad', purposes: ['sponsor_sharing'], relationship: 'processor' },
      ]);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('recipients[1]');
      expect(await getStoredRecipients(db)).toEqual([]);
    });

    it('refuses an unpapered joint controller', async () => {
      const result = await setStoredRecipients(db, adminId, [
        recipient({ relationship: 'independent_controller' }),
      ]);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('agreementRef');
    });

    it('refuses a duplicate id inside one save', async () => {
      const result = await setStoredRecipients(db, adminId, [recipient(), recipient()]);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('duplicate id');
    });

    it('refuses more than the stored maximum', async () => {
      const many = Array.from({ length: MAX_STORED_RECIPIENTS + 1 }, (_v, i) =>
        recipient({ id: `r${i}` }),
      );
      const result = await setStoredRecipients(db, adminId, many);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain(String(MAX_STORED_RECIPIENTS));
    });

    it('refuses a value that is not an array', async () => {
      const result = await setStoredRecipients(db, adminId, { recipients: [] });
      expect(result.ok).toBe(false);
    });

    it('replaces the whole list rather than merging into it', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'first' })]);
      await setStoredRecipients(db, adminId, [recipient({ id: 'second' })]);
      expect((await getStoredRecipients(db)).map((r) => r.id)).toEqual(['second']);
    });

    it('writes one audit row naming the ids added and removed', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'first' })]);
      await setStoredRecipients(db, adminId, [recipient({ id: 'second' })], { ip: '203.0.113.9' });

      const rows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, RECIPIENT_AUDIT_ACTIONS.save));
      expect(rows).toHaveLength(2);
      // Found by content, not by row order: two inserts inside one millisecond
      // have no guaranteed order and an ordering assumption would flake.
      const latest = rows.find(
        (row) => (row.metadata as { added?: string[] } | null)?.added?.includes('second') === true,
      );
      expect(latest, 'no audit row recorded the second save').toBeDefined();
      expect(latest?.userId).toBe(adminId);
      expect(latest?.targetId).toBe(DATA_SHARING_RECIPIENTS_SETTING_KEY);
      expect(latest?.ipAddress).toBe('203.0.113.9');
      // The IDS, not a count: "who did we start sending members' data to" is the
      // question this row exists to answer.
      expect(latest?.metadata).toMatchObject({ added: ['second'], removed: ['first'], count: 1 });
    });

    it('writes no audit row when the save is refused', async () => {
      await setStoredRecipients(db, adminId, [{ id: 'bad' }]);
      const rows = await db.select().from(auditLogs);
      expect(rows).toEqual([]);
    });
  });

  describe('clearStoredRecipients', () => {
    it('removes the row so the config file is the whole list again', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      const result = await clearStoredRecipients(db, adminId);
      expect(result.removed).toBe(true);
      expect(await getStoredRecipients(db)).toEqual([]);
      expect((await effectiveRecipients(db, cfg([recipient()]))).map((r) => r.id)).toEqual(['acme']);
    });

    it('reports nothing removed when there was no stored list, and writes no audit row', async () => {
      const result = await clearStoredRecipients(db, adminId);
      expect(result.removed).toBe(false);
      expect(await db.select().from(auditLogs)).toEqual([]);
    });
  });

  // --- The digest ---------------------------------------------------------------

  describe('effectiveDataSharingDocument', () => {
    it('carries the union into the document', async () => {
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      const doc = await effectiveDataSharingDocument(db, cfg([recipient()])) as {
        recipients: DataRecipient[];
        policyVersion: string;
      };
      expect(doc.recipients.map((r) => r.id)).toEqual(['acme', 'northwind']);
      expect(doc.policyVersion).toBe('1');
    });

    it('keeps the other settings from the config file', async () => {
      const doc = await effectiveDataSharingDocument(db, {
        dataSharing: { recipients: [recipient()], policyVersion: '7', minBucket: 9 },
      }) as { policyVersion: string; minBucket: number };
      expect(doc.policyVersion).toBe('7');
      expect(doc.minBucket).toBe(9);
    });

    it('falls back to schema defaults when the file document is malformed', async () => {
      const doc = await effectiveDataSharingDocument(db, { dataSharing: { minBucket: -3 } }) as {
        policyVersion: string;
        recipients: DataRecipient[];
      };
      expect(doc.policyVersion).toBe('1');
      expect(doc.recipients).toEqual([]);
    });

    it('MOVES the scope digest when a recipient is added in the database', async () => {
      // The whole reason this resolver exists. Without it `currentPurposeScope`
      // reads the file alone, and an admin-added recipient would receive members'
      // data on a grant given before it was ever named to them.
      const config = cfg([recipient()]);
      const resolvers = { dataSharing: effectiveDataSharingDocument };

      const before = await currentPurposeScope(db, config, resolvers);
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      const after = await currentPurposeScope(db, config, resolvers);

      expect(after.digest).not.toBe(before.digest);
      expect(after.recipients.map((r) => r.id)).toEqual(['acme', 'northwind']);
    });

    it('leaves the digest untouched when the resolver is not passed (the trap)', async () => {
      // Documented so the omission is loud: a route that forgets the resolver
      // computes the digest over the FILE recipients only.
      const config = cfg([recipient()]);
      const before = await currentPurposeScope(db, config);
      await setStoredRecipients(db, adminId, [recipient({ id: 'northwind' })]);
      const after = await currentPurposeScope(db, config);
      expect(after.digest).toBe(before.digest);
    });
  });

  // --- Isolation (plan D1) ------------------------------------------------------

  describe('isolation from the aggregate pipeline', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const SOURCE = resolve(here, '..', 'persona', 'recipients.ts');
    const source = readFileSync(SOURCE, 'utf8');

    it('read the module source, so the assertions below walk something', () => {
      // P7: a broken path would make every assertion here vacuously true.
      expect(source.length).toBeGreaterThan(1000);
      expect(source).toContain('effectiveRecipients');
    });

    it('imports nothing from the metrics module', () => {
      const imports = source.match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
      expect(imports.length).toBeGreaterThan(2);
      for (const line of imports) {
        expect(line).not.toContain('./metrics');
        expect(line).not.toContain('./directory');
      }
    });

    it('names no k-anonymity machinery in code', () => {
      // The directory identifies individuals on purpose. Suppression, floors and
      // quantisation belong to the aggregates and must not leak either way.
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const forbidden of ['METRICS_MIN_BUCKET', 'MIN_AUDIENCE_POPULATION', 'bandPersonaCount']) {
        expect(withoutComments).not.toContain(forbidden);
      }
    });
  });
});
