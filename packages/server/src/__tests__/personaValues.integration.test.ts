import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  auditLogs,
  instanceSettings,
  userPersonaAnswers,
  userPersonaText,
  userSharedLinks,
  users,
} from '@commonpub/schema';
import { type PersonaSection, personaCompleteness } from '@commonpub/persona';
import type { CommonPubConfig } from '@commonpub/config';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  effectivePersonaSchema,
  invalidatePersonaSchemaCache,
} from '../persona/registry.js';
import {
  PERSONA_CHECKBOX_VALUE,
  countPersonaFieldRows,
  deletePersonaFieldValue,
  getPersonaValues,
  listSharedLinkPlatforms,
  personaAnswerMap,
  purgePersonaField,
  retirePersonaField,
  setPersonaSection,
  setSharedLinkPlatforms,
  validatePersonaSectionAnswers,
} from '../persona/values.js';

// Plan 10.3 `personaValues.integration.test.ts`: unchecking every box in a
// section clears the rows (the template-scoped delete); a partial save of
// section A does not touch section B; an unknown field key is rejected; a field
// removed with `purge` deletes its rows in the same transaction; a field removed
// with `retain` keeps them, surfaces them in the read, and can be deleted by the
// user.
//
// NOT covered, deliberately: the 0046 link backfill. Plan 14.4 defers
// `user_profile_links` and the `social_links` cutover entirely, so there is no
// backfill in v1 to test.

const SECTIONS: PersonaSection[] = [
  {
    key: 'basics',
    label: 'Basics',
    fields: [
      { key: 'display_name', label: 'Display name', type: 'text', maxLength: 128, column: 'displayName' },
      { key: 'pronouns', label: 'Pronouns', type: 'text', column: 'pronouns' },
      { key: 'about', label: 'About you', type: 'textarea', maxLength: 40 },
      { key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' },
      { key: 'homepage', label: 'Homepage', type: 'url' },
      { key: 'newsletter', label: 'Newsletter', type: 'checkbox' },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      {
        key: 'interests',
        label: 'Interests',
        type: 'multiselect',
        maxSelections: 2,
        options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'software', label: 'Software' },
          { value: 'robotics', label: 'Robotics' },
        ],
      },
      {
        key: 'industry',
        label: 'Industry',
        type: 'select',
        options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'education', label: 'Education' },
        ],
      },
    ],
  },
];

const CONFIG = {
  instance: { domain: 'test.example', name: 'Test' },
  features: {},
  persona: { sections: SECTIONS },
} as unknown as CommonPubConfig;

describe('persona values: read, write, retire', () => {
  let db: DB;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    db = await createTestDB();
    adminId = (await createTestUser(db, { username: 'values-admin', role: 'admin' })).id;
  });
  afterAll(async () => { await closeTestDB(db); });

  beforeEach(async () => {
    await db.delete(userPersonaAnswers);
    await db.delete(userPersonaText);
    await db.delete(userSharedLinks);
    await db.delete(instanceSettings);
    await db.delete(auditLogs);
    invalidatePersonaSchemaCache(db);
    userId = (await createTestUser(db, { username: `values-user-${crypto.randomUUID().slice(0, 8)}` })).id;
  });

  async function save(
    sectionKey: string,
    answers: Record<string, string | string[] | null>,
  ): ReturnType<typeof setPersonaSection> {
    return setPersonaSection(db, { userId, sectionKey, answers, config: CONFIG });
  }

  describe('the template-scoped delete (plan 4.5)', () => {
    it('clears a multiselect when every box is unchecked', async () => {
      const first = await save('interests', { interests: ['hardware', 'robotics'] });
      expect(first.ok).toBe(true);
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(2);

      // The payload for "I unchecked everything" carries NO values. Scoping the
      // delete to the submitted keys would make this a no-op and a user could
      // never withdraw an answer they regret.
      const cleared = await save('interests', { interests: [] });
      expect(cleared.ok).toBe(true);
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(0);
    });

    it('clears a multiselect when the key is omitted from the payload entirely', async () => {
      await save('interests', { interests: ['hardware'] });
      const cleared = await save('interests', {});
      expect(cleared.ok).toBe(true);
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(0);
    });

    it('keeps the values that are still checked and drops the rest', async () => {
      await save('interests', { interests: ['hardware', 'robotics'] });
      await save('interests', { interests: ['robotics'] });
      const rows = await db.select().from(userPersonaAnswers);
      expect(rows.map((r) => r.value)).toEqual(['robotics']);
    });

    it('clears a free-text field too (Appendix B13)', async () => {
      await save('basics', { about: 'Building things' });
      expect(await db.select().from(userPersonaText)).toHaveLength(1);

      const cleared = await save('basics', { about: '' });
      expect(cleared.ok).toBe(true);
      expect(await db.select().from(userPersonaText)).toHaveLength(0);
    });

    it('clears a profile link too (Appendix B13)', async () => {
      await save('basics', { link_github: 'https://github.com/someone' });
      const [before] = await db.select({ links: users.socialLinks }).from(users).where(eq(users.id, userId));
      expect(before?.links?.github).toBe('https://github.com/someone');

      await save('basics', { link_github: '' });
      const [after] = await db.select({ links: users.socialLinks }).from(users).where(eq(users.id, userId));
      expect(after?.links?.github).toBeUndefined();
    });

    it('does not touch another section', async () => {
      await save('interests', { interests: ['hardware'], industry: 'education' });
      await save('basics', { about: 'Hello' });

      const rows = await db.select().from(userPersonaAnswers);
      expect(rows.map((r) => r.fieldKey).sort()).toEqual(['industry', 'interests']);

      // And a partial save of `interests` leaves `basics` alone.
      await save('interests', { interests: [] });
      expect(await db.select().from(userPersonaText)).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('rejects an unknown field key outright', async () => {
      const result = await save('interests', { smuggled: 'value' });
      expect(result).toMatchObject({ ok: false, fieldKey: 'smuggled' });
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(0);
    });

    it('rejects a field that belongs to a different section', async () => {
      const result = await save('interests', { about: 'wrong section' });
      expect(result.ok).toBe(false);
    });

    it('rejects an unknown section', async () => {
      const result = await save('nope', {});
      expect(result.ok).toBe(false);
    });

    it('rejects an option the field does not offer', async () => {
      const result = await save('interests', { interests: ['aerospace'] });
      expect(result).toMatchObject({ ok: false, fieldKey: 'interests' });
    });

    it('enforces maxSelections', async () => {
      const result = await save('interests', { interests: ['hardware', 'software', 'robotics'] });
      expect(result).toMatchObject({ ok: false, fieldKey: 'interests' });
    });

    it('rejects two values for a single-choice field', async () => {
      const result = await save('interests', { industry: ['hardware', 'education'] });
      expect(result).toMatchObject({ ok: false, fieldKey: 'industry' });
    });

    it('enforces the template maxLength on free text', async () => {
      const result = await save('basics', { about: 'x'.repeat(41) });
      expect(result).toMatchObject({ ok: false, fieldKey: 'about' });
    });

    it('rejects a javascript: URL in a url field', async () => {
      // Domain validation, not shape validation: the value is a perfectly good
      // string and a completely unacceptable URL.
      const result = await save('basics', { homepage: 'javascript:alert(1)' });
      expect(result).toMatchObject({ ok: false, fieldKey: 'homepage' });
    });

    it('rejects a link that is not on the declared platform', async () => {
      const result = await save('basics', { link_github: 'https://evilgithub.com/someone' });
      expect(result).toMatchObject({ ok: false, fieldKey: 'link_github' });
    });

    it('writes nothing at all when one field in the section is invalid', async () => {
      await save('interests', { interests: ['hardware'] });
      const bad = await save('interests', { interests: ['software'], industry: 'nope' });
      expect(bad.ok).toBe(false);
      const rows = await db.select().from(userPersonaAnswers);
      expect(rows.map((r) => r.value)).toEqual(['hardware']);
    });

    it('is a pure function of the template, with no database anywhere near it', () => {
      const result = validatePersonaSectionAnswers(SECTIONS[1]!, { interests: ['hardware'] }, []);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // One entry per TEMPLATE field, not per submitted key. That shape IS the
        // template-scoped delete.
        expect(result.result.answers.map((a) => a.fieldKey)).toEqual(['interests', 'industry']);
        expect(result.result.answers[1]!.values).toEqual([]);
      }
    });
  });

  describe('the sinks', () => {
    it('routes a column-bound field through updateUserProfile', async () => {
      const result = await save('basics', { display_name: 'Ada', pronouns: 'she/her' });
      expect(result.ok).toBe(true);

      const [row] = await db
        .select({ displayName: users.displayName, pronouns: users.pronouns })
        .from(users)
        .where(eq(users.id, userId));
      expect(row).toMatchObject({ displayName: 'Ada', pronouns: 'she/her' });
      // Nothing landed in the persona tables: a column-bound field has no persona row.
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(0);
      expect(await db.select().from(userPersonaText)).toHaveLength(0);
    });

    it('merges a link into users.social_links without clobbering the others', async () => {
      await db
        .update(users)
        .set({ socialLinks: { twitter: 'https://x.com/someone' } })
        .where(eq(users.id, userId));

      await save('basics', { link_github: 'https://github.com/someone' });

      const [row] = await db.select({ links: users.socialLinks }).from(users).where(eq(users.id, userId));
      expect(row?.links).toEqual({
        twitter: 'https://x.com/someone',
        github: 'https://github.com/someone',
      });
    });

    it('stores a ticked checkbox as one canonical row', async () => {
      await save('basics', { newsletter: 'true' });
      const rows = await db.select().from(userPersonaAnswers).where(eq(userPersonaAnswers.fieldKey, 'newsletter'));
      expect(rows.map((r) => r.value)).toEqual([PERSONA_CHECKBOX_VALUE]);

      await save('basics', { newsletter: 'false' });
      expect(await db.select().from(userPersonaAnswers)).toHaveLength(0);
    });

    it('reads every sink back, partitioned as stored', async () => {
      await save('basics', {
        display_name: 'Ada',
        about: 'Building things',
        link_github: 'https://github.com/someone',
        newsletter: 'yes',
      });
      await save('interests', { interests: ['hardware', 'software'], industry: 'education' });

      const { sections } = await effectivePersonaSchema(db, CONFIG);
      const values = await getPersonaValues(db, userId, sections);

      expect(values.columns).toEqual({ display_name: 'Ada' });
      expect(values.text).toEqual({ about: 'Building things' });
      expect(values.links).toEqual({ link_github: 'https://github.com/someone' });
      expect(values.answers.interests?.sort()).toEqual(['hardware', 'software']);
      expect(values.answers.industry).toEqual(['education']);
      expect(values.retired).toEqual([]);

      // The completeness helper takes the flattened map and nothing else. It has
      // no consent argument and never will.
      const completeness = personaCompleteness(sections, personaAnswerMap(sections, values));
      expect(completeness.filledFields).toBe(6);
      expect(completeness.totalFields).toBe(8);
    });
  });

  describe('retired fields (plan 4.6)', () => {
    const WITHOUT_INTERESTS = {
      ...CONFIG,
      persona: { sections: [SECTIONS[0]!] },
    } as unknown as CommonPubConfig;

    beforeEach(async () => {
      await save('interests', { interests: ['hardware', 'robotics'], industry: 'education' });
      await save('basics', { about: 'Building things' });
      invalidatePersonaSchemaCache(db);
    });

    it('purge deletes every row for the field and audits the count', async () => {
      expect(await countPersonaFieldRows(db, 'interests')).toBe(2);

      const purged = await purgePersonaField(db, { fieldKey: 'interests', adminId });
      expect(purged.deleted).toBe(2);
      expect(await countPersonaFieldRows(db, 'interests')).toBe(0);
      // Another FIELD is untouched. (Cross-user isolation for purge has no
    // coverage anywhere; this fixture holds one user.)
      expect(await countPersonaFieldRows(db, 'industry')).toBe(1);

      const [audit] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'persona.field.purge'));
      expect(audit?.metadata).toMatchObject({ deleted: 2 });
    });

    it('retain keeps the rows, surfaces them by raw key, and lets the user delete them', async () => {
      const retained = await retirePersonaField(db, { fieldKey: 'interests', adminId });
      expect(retained.retained).toBe(2);

      const [audit] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'persona.field.retain'));
      expect(audit?.metadata).toMatchObject({ retained: 2 });

      const { sections } = await effectivePersonaSchema(db, WITHOUT_INTERESTS);
      const values = await getPersonaValues(db, userId, sections);
      const retiredKeys = values.retired.map((r) => r.fieldKey);
      // Raw field keys, because no label resolves for a question that is gone.
      expect(retiredKeys).toContain('interests');
      const interests = values.retired.find((r) => r.fieldKey === 'interests');
      expect(interests?.values.sort()).toEqual(['hardware', 'robotics']);
      expect(interests?.retiredAt).toBeTruthy();

      const deleted = await deletePersonaFieldValue(db, { userId, fieldKey: 'interests' });
      expect(deleted.deleted).toBe(2);

      const after = await getPersonaValues(db, userId, sections);
      expect(after.retired.map((r) => r.fieldKey)).not.toContain('interests');
    });

    it('surfaces an orphaned key even when nobody recorded a retirement', async () => {
      const { sections } = await effectivePersonaSchema(db, WITHOUT_INTERESTS);
      const values = await getPersonaValues(db, userId, sections);
      const interests = values.retired.find((r) => r.fieldKey === 'interests');
      // Art. 15 does not wait for the operator to fill in the paperwork.
      expect(interests?.values.sort()).toEqual(['hardware', 'robotics']);
      expect(interests?.retiredAt).toBeNull();
    });

    it('lets a user delete a field that is still in the schema', async () => {
      // Erasure is the data subject's right, not a function of whether the
      // operator still asks the question.
      const deleted = await deletePersonaFieldValue(db, { userId, fieldKey: 'about' });
      expect(deleted.deleted).toBe(1);
      expect(await db.select().from(userPersonaText)).toHaveLength(0);
    });
  });

  describe('per-platform link sharing (plan R3.1 D6)', () => {
    async function shared(): Promise<string[]> {
      return listSharedLinkPlatforms(db, userId);
    }

    it('starts empty, because a row is the whole of "shared"', async () => {
      // The default is off BY CONSTRUCTION. There is no column holding `false`
      // that a later migration could flip, and no member has to find a control
      // to be left alone.
      expect(await shared()).toEqual([]);
      expect(await db.select().from(userSharedLinks)).toHaveLength(0);
    });

    it('writes one row per chosen platform and reads them back sorted', async () => {
      const result = await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['linkedin', 'github'],
        config: CONFIG,
      });
      expect(result).toEqual({ ok: true, platforms: ['github', 'linkedin'] });
      expect(await shared()).toEqual(['github', 'linkedin']);
    });

    it('unticking one platform removes only that one', async () => {
      await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github', 'linkedin'],
        config: CONFIG,
      });
      const result = await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github'],
        config: CONFIG,
      });
      expect(result).toEqual({ ok: true, platforms: ['github'] });
    });

    it('unticking EVERY platform actually clears them', async () => {
      // The failure this is here to catch is the one `setPersonaSection` had to
      // be written around: a delete scoped to the submitted keys makes an empty
      // submission a no-op, so a member who unticks everything stays shared and
      // is never told.
      await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github', 'linkedin', 'mastodon'],
        config: CONFIG,
      });
      expect(await shared()).toHaveLength(3);

      const cleared = await setSharedLinkPlatforms(db, { userId, platforms: [], config: CONFIG });
      expect(cleared).toEqual({ ok: true, platforms: [] });
      expect(await db.select().from(userSharedLinks)).toHaveLength(0);
    });

    it('re-ticking a platform keeps the time the member first agreed', async () => {
      await setSharedLinkPlatforms(db, { userId, platforms: ['github'], config: CONFIG });
      const [first] = await db
        .select({ createdAt: userSharedLinks.createdAt })
        .from(userSharedLinks)
        .where(eq(userSharedLinks.userId, userId));
      expect(first?.createdAt).toBeInstanceOf(Date);

      await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github', 'linkedin'],
        config: CONFIG,
      });
      const [again] = await db
        .select({ createdAt: userSharedLinks.createdAt })
        .from(userSharedLinks)
        .where(eq(userSharedLinks.platform, 'github'));
      expect(again?.createdAt?.getTime()).toBe(first?.createdAt?.getTime());
    });

    it('refuses an unknown platform, and writes nothing at all', async () => {
      await setSharedLinkPlatforms(db, { userId, platforms: ['github'], config: CONFIG });
      const result = await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github', 'not_a_platform'],
        config: CONFIG,
      });
      expect(result).toMatchObject({ ok: false, platform: 'not_a_platform' });
      // Validation happens before the transaction opens, so the earlier choice
      // is untouched rather than half-rewritten.
      expect(await shared()).toEqual(['github']);
    });

    it('deduplicates and ignores blanks in the submission', async () => {
      const result = await setSharedLinkPlatforms(db, {
        userId,
        platforms: ['github', 'github', '  ', 'linkedin'],
        config: CONFIG,
      });
      expect(result).toEqual({ ok: true, platforms: ['github', 'linkedin'] });
    });

    it('is per member: clearing one member does not touch another', async () => {
      const other = (await createTestUser(db, { username: `values-other-${crypto.randomUUID().slice(0, 8)}` })).id;
      await setSharedLinkPlatforms(db, { userId, platforms: ['github'], config: CONFIG });
      await setSharedLinkPlatforms(db, { userId: other, platforms: ['github'], config: CONFIG });

      await setSharedLinkPlatforms(db, { userId, platforms: [], config: CONFIG });
      expect(await shared()).toEqual([]);
      expect(await listSharedLinkPlatforms(db, other)).toEqual(['github']);
    });
  });
});
