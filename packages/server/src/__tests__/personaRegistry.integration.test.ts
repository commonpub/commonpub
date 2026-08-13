import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { auditLogs, instanceSettings, userPersonaAnswers, userPersonaText } from '@commonpub/schema';
import { BUILTIN_PERSONA_SECTIONS, type PersonaSection } from '@commonpub/persona';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  PERSONA_AUDIT_ACTIONS,
  PERSONA_SECTIONS_SETTING_KEY,
  acknowledgePersonaDrift,
  clearPersonaSchemaOverride,
  effectivePersonaSchema,
  invalidatePersonaSchemaCache,
  listPersonaAggregatableFields,
  parsePersonaConfig,
  sanitizePersonaSchema,
  savePersonaSchemaOverride,
} from '../persona/registry.js';
import { retirePersonaField } from '../persona/values.js';

// Plan 10.3 `personaRegistry.integration.test.ts`: a DB override wins
// whole-document; DELETE reverts to file; a malformed DB row falls back to
// config through `sanitizePersonaSchema`; a key renamed in the config source
// produces a drift row, an audit line, and exclusion from
// `listPersonaAggregatableFields` until acknowledged.

function section(key: string, fields: PersonaSection['fields']): PersonaSection {
  return { key, label: key.toUpperCase(), fields };
}

const FILE_SECTIONS: PersonaSection[] = [
  section('interests', [
    {
      key: 'interests',
      label: 'Interests',
      type: 'multiselect',
      options: [
        { value: 'hardware', label: 'Hardware' },
        { value: 'software', label: 'Software' },
        { value: 'robotics', label: 'Robotics' },
      ],
    },
  ]),
];

function cfg(persona?: unknown): CommonPubConfig {
  return {
    instance: { domain: 'test.example', name: 'Test' },
    features: {},
    ...(persona === undefined ? {} : { persona }),
  } as unknown as CommonPubConfig;
}

const FILE_CONFIG = cfg({ sections: FILE_SECTIONS });

describe('persona registry: precedence, sanitizing, drift', () => {
  let db: DB;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    adminId = (await createTestUser(db, { username: 'persona-admin', role: 'admin' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  beforeEach(async () => {
    // Every test starts from "no DB override, no stored answers, no bookkeeping".
    await db.delete(instanceSettings);
    await db.delete(userPersonaAnswers);
    await db.delete(userPersonaText);
    await db.delete(auditLogs);
    invalidatePersonaSchemaCache(db);
  });

  describe('precedence', () => {
    it('falls back to the built-ins when neither source declares sections', async () => {
      const effective = await effectivePersonaSchema(db, cfg());
      expect(effective.source).toBe('builtin');
      expect(effective.sections.map((s) => s.key)).toEqual(
        BUILTIN_PERSONA_SECTIONS.map((s) => s.key),
      );
      expect(effective.savedAt).toBeNull();
    });

    it('uses the config file when it declares sections', async () => {
      const effective = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(effective.source).toBe('config');
      expect(effective.sections.map((s) => s.key)).toEqual(['interests']);
    });

    it('lets a DB override win as a WHOLE DOCUMENT, never key by key', async () => {
      const dbSections: PersonaSection[] = [
        section('workshop', [
          {
            key: 'bench',
            label: 'Bench',
            type: 'select',
            options: [{ value: 'small', label: 'Small' }],
          },
        ]),
      ];
      const saved = await savePersonaSchemaOverride(db, { sections: dbSections, adminId });
      expect(saved.ok).toBe(true);

      const effective = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(effective.source).toBe('database');
      // The file's `interests` section is GONE, not merged in. A key-by-key merge
      // would resurrect a section the operator deleted.
      expect(effective.sections.map((s) => s.key)).toEqual(['workshop']);
      expect(effective.savedAt).toBeInstanceOf(Date);
    });

    it('reverts to the file when the override is deleted', async () => {
      await savePersonaSchemaOverride(db, { sections: [section('workshop', [])], adminId });
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).source).toBe('database');

      const removed = await clearPersonaSchemaOverride(db, { adminId });
      expect(removed.removed).toBe(true);

      const effective = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(effective.source).toBe('config');
      expect(effective.sections.map((s) => s.key)).toEqual(['interests']);
      expect(effective.savedAt).toBeNull();

      const [audit] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, PERSONA_AUDIT_ACTIONS.revert));
      expect(audit).toBeDefined();
    });

    it('reports a second delete as a no-op', async () => {
      expect((await clearPersonaSchemaOverride(db, { adminId })).removed).toBe(false);
    });
  });

  describe('sink-side sanitizer', () => {
    it('drops a section that fails validation and keeps the rest', () => {
      const kept = sanitizePersonaSchema([
        { key: 'good', label: 'Good', fields: [] },
        { key: 'BAD KEY', label: 'Bad', fields: [] },
        { key: 'evil', label: 'Evil', fields: [{ key: 'x', label: 'X', type: 'nope' }] },
      ]);
      expect(kept?.map((s) => s.key)).toEqual(['good']);
    });

    it('refuses the whole document when what survives still fails the cross-section rules', () => {
      // Two sections sharing a FIELD key: valid one at a time, invalid together,
      // because `field_key` is the global analytics namespace.
      const shared = {
        key: 'interests',
        label: 'Interests',
        type: 'select' as const,
        options: [{ value: 'a', label: 'A' }],
      };
      expect(sanitizePersonaSchema([
        { key: 'one', label: 'One', fields: [shared] },
        { key: 'two', label: 'Two', fields: [shared] },
      ])).toBeNull();
    });

    it('falls back to the config source when the stored row is malformed', async () => {
      // Simulate the generic `PUT /api/admin/settings` route writing junk under
      // `persona.sections`, which is exactly what the sanitizer exists for.
      await db.insert(instanceSettings).values({
        key: PERSONA_SECTIONS_SETTING_KEY,
        value: { source: 'admin', savedAt: new Date().toISOString(), sections: [{ nope: true }] },
        updatedBy: adminId,
      });
      invalidatePersonaSchemaCache(db);

      const effective = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(effective.source).toBe('config');
      expect(effective.sections.map((s) => s.key)).toEqual(['interests']);
    });

    it('falls back to the config source when the stored value is not a document at all', async () => {
      await db.insert(instanceSettings).values({
        key: PERSONA_SECTIONS_SETTING_KEY,
        value: 'sections',
        updatedBy: adminId,
      });
      invalidatePersonaSchemaCache(db);
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).source).toBe('config');
    });

    it('reads a bare array, which is what the generic route would write', async () => {
      await db.insert(instanceSettings).values({
        key: PERSONA_SECTIONS_SETTING_KEY,
        value: [{ key: 'bare', label: 'Bare', fields: [] }],
        updatedBy: adminId,
      });
      invalidatePersonaSchemaCache(db);
      const effective = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(effective.source).toBe('database');
      expect(effective.sections.map((s) => s.key)).toEqual(['bare']);
      // No `savedAt` was stored, so none is invented.
      expect(effective.savedAt).toBeNull();
    });
  });

  describe('config parsing', () => {
    it('reports a malformed config file instead of throwing', () => {
      const parsed = parsePersonaConfig(cfg({ sections: [{ key: 'no label' }] }));
      expect(parsed.config).toBeNull();
      expect(parsed.error).toMatch(/Invalid persona config/);
    });

    it('serves the built-ins rather than a broken config', async () => {
      const effective = await effectivePersonaSchema(db, cfg({ sections: 'not an array' }));
      expect(effective.source).toBe('builtin');
    });
  });

  describe('the drift reconciler', () => {
    async function storeAnswer(userId: string, fieldKey: string, value: string): Promise<void> {
      await db.insert(userPersonaAnswers).values({
        userId, sectionKey: 'interests', fieldKey, value,
      });
    }

    it('flags a key renamed in the config source, audits it, and never touches the data', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-1' })).id;
      await storeAnswer(userId, 'interests', 'hardware');
      await storeAnswer(userId, 'interests', 'robotics');

      // The operator renames the key in `commonpub.config.ts` and deploys. No
      // admin route ran, so nothing validated the change.
      const renamed = cfg({
        sections: [section('interests', [
          { ...FILE_SECTIONS[0]!.fields[0]!, key: 'topics' },
        ])],
      });

      const effective = await effectivePersonaSchema(db, renamed);
      const drift = effective.drift.filter((d) => d.fieldKey === 'interests');
      expect(drift).toHaveLength(1);
      expect(drift[0]!.kind).toBe('missing_field');
      // K-ANONYMISED. Two rows is below `METRICS_MIN_BUCKET`, and this figure
      // reaches `GET /api/admin/persona/schema` AND `audit_logs.metadata`, which
      // is readable through `/api/admin/audit`. It counts answers from members
      // who never consented to being counted, so the exact number has no lawful
      // reader; the operator is told the change is destructive, in a band.
      expect(drift[0]!.affectedRows).toBe(0);
      expect(drift[0]!.affectedRowsBanded).toBe(true);
      expect(drift[0]!.acknowledgedAt).toBeNull();

      const audit = await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.action, PERSONA_AUDIT_ACTIONS.drift),
          eq(auditLogs.targetId, 'interests'),
        ));
      expect(audit).toHaveLength(1);

      // The reconciler NEVER mutates user data on its own.
      const rows = await db.select().from(userPersonaAnswers);
      expect(rows).toHaveLength(2);
    });

    it('does not re-audit the same drift on every cache miss', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-2' })).id;
      await storeAnswer(userId, 'interests', 'hardware');
      const renamed = cfg({ sections: [section('other', [])] });

      await effectivePersonaSchema(db, renamed);
      invalidatePersonaSchemaCache(db);
      await effectivePersonaSchema(db, renamed);
      invalidatePersonaSchemaCache(db);
      await effectivePersonaSchema(db, renamed);

      const audit = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, PERSONA_AUDIT_ACTIONS.drift));
      expect(audit).toHaveLength(1);
    });

    it('flags a stored option the field no longer offers', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-3' })).id;
      await storeAnswer(userId, 'interests', 'robotics');

      const trimmed = cfg({
        sections: [section('interests', [
          {
            key: 'interests',
            label: 'Interests',
            type: 'multiselect',
            options: [{ value: 'hardware', label: 'Hardware' }],
          },
        ])],
      });

      const { drift } = await effectivePersonaSchema(db, trimmed);
      expect(drift).toHaveLength(1);
      expect(drift[0]!.kind).toBe('missing_option');
      // The option VALUES are deliberately not named: a per-option census of
      // who chose what is the distribution the metrics module refuses to
      // publish, and this string lands in `audit_logs` permanently.
      expect(drift[0]!.detail).not.toContain('robotics');
      expect(drift[0]!.detail).toContain('1 option');
      expect(drift[0]!.affectedRows).toBe(0);
      expect(drift[0]!.affectedRowsBanded).toBe(true);
    });

    it('floors a drift count that DOES clear the bucket floor, rather than banding it', async () => {
      // The band is not "always zero": above the floor the operator gets a real
      // (floored) number, which is what makes the destructive-save decision
      // actionable at all.
      const trimmed = cfg({
        sections: [section('interests', [
          {
            key: 'interests',
            label: 'Interests',
            type: 'multiselect',
            options: [{ value: 'hardware', label: 'Hardware' }],
          },
        ])],
      });
      for (let i = 0; i < 7; i += 1) {
        const uid = (await createTestUser(db, { username: `drift-floor-${i}` })).id;
        await storeAnswer(uid, 'interests', 'robotics');
      }

      const { drift } = await effectivePersonaSchema(db, trimmed);
      const option = drift.find((d) => d.kind === 'missing_option');
      expect(option?.affectedRows).toBe(5);
      expect(option?.affectedRowsBanded).toBe(false);
    });

    it('flags a field whose answers now live in the wrong table', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-4' })).id;
      await storeAnswer(userId, 'interests', 'hardware');

      // multiselect (answers) becomes textarea (text): the rows are stranded.
      const retyped = cfg({
        sections: [section('interests', [
          { key: 'interests', label: 'Interests', type: 'textarea' },
        ])],
      });

      const { drift } = await effectivePersonaSchema(db, retyped);
      expect(drift.map((d) => d.kind).sort()).toEqual(['sink_changed']);
    });

    it('excludes a drifted field from the aggregatable list until it is acknowledged', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-5' })).id;
      await storeAnswer(userId, 'interests', 'robotics');

      const trimmed = cfg({
        sections: [section('interests', [
          {
            key: 'interests',
            label: 'Interests',
            type: 'multiselect',
            options: [{ value: 'hardware', label: 'Hardware' }],
          },
        ])],
      });

      expect(await listPersonaAggregatableFields(db, trimmed)).toEqual([]);

      const ack = await acknowledgePersonaDrift(db, trimmed, { fieldKey: 'interests', adminId });
      expect(ack.ok).toBe(true);

      const fields = await listPersonaAggregatableFields(db, trimmed);
      expect(fields.map((f) => f.key)).toEqual(['interests']);
      expect(fields[0]!.options.map((o) => o.value)).toEqual(['hardware']);

      // The acknowledgement is bound to what was acknowledged: a NEW drift on the
      // same key surfaces again rather than inheriting the old "yes, I know".
      await storeAnswer(userId, 'interests', 'software');
      invalidatePersonaSchemaCache(db);
      const { drift } = await effectivePersonaSchema(db, trimmed);
      expect(drift).toHaveLength(1);
      expect(drift[0]!.acknowledgedAt).toBeNull();
    });

    it('refuses to acknowledge a field with no drift', async () => {
      const result = await acknowledgePersonaDrift(db, FILE_CONFIG, {
        fieldKey: 'interests',
        adminId,
      });
      expect(result.ok).toBe(false);
    });

    it('treats a deliberately retired key as settled, not as drift', async () => {
      const userId = (await createTestUser(db, { username: 'drift-user-6' })).id;
      await storeAnswer(userId, 'interests', 'hardware');
      const withoutField = cfg({ sections: [section('other', [])] });

      const before = await effectivePersonaSchema(db, withoutField);
      expect(before.drift).toHaveLength(1);

      await retirePersonaField(db, { fieldKey: 'interests', adminId });
      const after = await effectivePersonaSchema(db, withoutField);
      expect(after.drift).toEqual([]);
    });
  });

  describe('listPersonaAggregatableFields', () => {
    it('returns only fields that can ever become a bucket', async () => {
      const mixed = cfg({
        sections: [section('mixed', [
          { key: 'display_name', label: 'Name', type: 'text', column: 'displayName' },
          { key: 'about', label: 'About', type: 'textarea' },
          { key: 'industry', label: 'Industry', type: 'select', options: [{ value: 'hw', label: 'HW' }] },
          {
            key: 'health',
            label: 'Health',
            type: 'select',
            sensitive: true,
            options: [{ value: 'x', label: 'X' }],
          },
          {
            key: 'private_pick',
            label: 'Private',
            type: 'select',
            analytics: false,
            options: [{ value: 'y', label: 'Y' }],
          },
          { key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' },
        ])],
      });

      const fields = await listPersonaAggregatableFields(db, mixed);
      expect(fields.map((f) => f.key)).toEqual(['industry']);
      expect(fields[0]).toMatchObject({ sectionKey: 'mixed', type: 'select', maxSelections: null });
    });

    it('excludes a retired key even when it is back in the schema', async () => {
      await retirePersonaField(db, { fieldKey: 'interests', adminId });
      const fields = await listPersonaAggregatableFields(db, FILE_CONFIG);
      expect(fields).toEqual([]);
    });
  });

  describe('the 60s cache', () => {
    it('serves a cached answer until a writer invalidates it', async () => {
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).source).toBe('config');

      // A direct settings write is NOT seen: the cache is only invalidated by the
      // writers in this module, which is one reason the dedicated admin route exists.
      await db.insert(instanceSettings).values({
        key: PERSONA_SECTIONS_SETTING_KEY,
        value: [{ key: 'sneaky', label: 'Sneaky', fields: [] }],
        updatedBy: adminId,
      });
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).source).toBe('config');

      invalidatePersonaSchemaCache(db);
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).source).toBe('database');
    });

    it('does not serve one config file answer to another', async () => {
      expect((await effectivePersonaSchema(db, FILE_CONFIG)).sections.map((s) => s.key))
        .toEqual(['interests']);
      const other = cfg({ sections: [section('other', [])] });
      expect((await effectivePersonaSchema(db, other)).sections.map((s) => s.key))
        .toEqual(['other']);
    });

    it('hands back a copy, so a caller cannot poison the cache', async () => {
      const first = await effectivePersonaSchema(db, FILE_CONFIG);
      first.sections.length = 0;
      const second = await effectivePersonaSchema(db, FILE_CONFIG);
      expect(second.sections).toHaveLength(1);
    });
  });
});
