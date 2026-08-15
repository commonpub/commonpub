import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
  auditLogs,
  instanceSettings,
  userPersonaAnswers,
  userPersonaText,
  users,
} from '@commonpub/schema';
import type { CommonPubConfig } from '@commonpub/config';
import {
  BUILTIN_PERSONA_SECTIONS,
  type PersonaConfig,
  type PersonaField,
  type PersonaFieldType,
  type PersonaLinkPlatformSpec,
  type PersonaSection,
  effectiveLinkPlatforms,
  fnv1a32,
  isPersonaFieldAggregatable,
  isPersonaFieldType,
  personaConfigSchema,
  personaFieldSink,
  personaFieldSpec,
  personaLinkPlatformSchema,
  personaSectionSchema,
  personaSectionsSchema,
} from '@commonpub/persona';
import { METRICS_MIN_BUCKET } from '@commonpub/persona';
import type { DB } from '../types.js';
import { getInstanceSetting } from '../admin/admin.js';
import { bandPersonaCount } from './metrics.js';

/**
 * Persona schema resolution (plan sections 5.3 and 5.3.1).
 *
 * Three sources, one precedence: the DATABASE override wins whole-document over
 * `commonpub.config.ts`, which wins over `BUILTIN_PERSONA_SECTIONS`. Never a
 * key-by-key merge: a section list is one coherent document, and merging keys
 * means an operator deletes a section in git and the DB resurrects it.
 *
 * Resolution lives here, in `@commonpub/server`, and NEVER in a fork's
 * `server/utils/config.ts`: that merge point is copied into every consumer app
 * (`layers/base/README.md`), so threading persona precedence through it would
 * make commonpub.io, deveco and heatsync each edit their own file or silently
 * get file-only sections.
 */

// --- Setting keys ---------------------------------------------------------------

/** Whole-document admin override of the persona sections. */
export const PERSONA_SECTIONS_SETTING_KEY = 'persona.sections';
/** Operator-declared link platforms saved from the admin UI (union, not override). */
export const PERSONA_LINK_PLATFORMS_SETTING_KEY = 'persona.linkPlatforms';
/** `fieldKey -> ISO date the field left the schema` (plan 4.6 "retain"). */
export const PERSONA_RETIRED_FIELDS_SETTING_KEY = 'persona.retiredFields';
/** `fieldKey -> { type }` observed when the first answer was stored (plan 5.4 key lock). */
export const PERSONA_FIELD_LOCKS_SETTING_KEY = 'persona.fieldLocks';
/** `fieldKey -> { at, digest }` acknowledgement of a specific drift (plan 5.3.1). */
export const PERSONA_DRIFT_ACK_SETTING_KEY = 'persona.driftAcknowledged';
/** Digest of the last drift set that produced audit rows, so boot does not re-audit. */
export const PERSONA_DRIFT_AUDITED_SETTING_KEY = 'persona.driftAudited';

/** Audit actions this module writes. Kept as literals so a grep finds every writer. */
export const PERSONA_AUDIT_ACTIONS = {
  drift: 'persona.schema.drift',
  save: 'persona.schema.save',
  revert: 'persona.schema.revert',
  acknowledge: 'persona.schema.drift.ack',
} as const;

// --- Types ----------------------------------------------------------------------

/** What the admin override row actually stores (plan 5.3.2 provenance). */
export interface StoredPersonaSchema {
  source: 'admin';
  /** ISO timestamp, used as the `If-Match` token by the admin PUT. */
  savedAt: string;
  sections: PersonaSection[];
}

export interface PersonaSchemaDrift {
  kind: 'missing_field' | 'type_changed' | 'sink_changed' | 'missing_option';
  fieldKey: string;
  detail: string;
  /**
   * K-ANONYMISED. Floored to a multiple of the bucket floor, and 0 when the true
   * count is below it, because this number reaches `GET /api/admin/persona/schema`
   * and is copied into `audit_logs.metadata`, which is readable through
   * `/api/admin/audit`. It is a count over answers from members who never
   * consented to being counted, so the exact figure has no lawful reader.
   * `affectedRowsBanded` says when it was withheld rather than merely small.
   */
  affectedRows: number;
  /** True when the real count fell below the floor and `affectedRows` is 0. */
  affectedRowsBanded: boolean;
  acknowledgedAt: Date | null;
}

export interface EffectivePersonaSchema {
  sections: PersonaSection[];
  source: 'database' | 'config' | 'builtin';
  /** When the DB override was written; null for the config and built-in sources. */
  savedAt: Date | null;
  drift: PersonaSchemaDrift[];
}

/** One aggregatable field, flattened for the analytics and consent surfaces. */
export interface PersonaAggregatableField {
  key: string;
  label: string;
  sectionKey: string;
  sectionLabel: string;
  type: PersonaFieldType;
  /** Multiselect only; null everywhere else. */
  maxSelections: number | null;
  /** Empty for a checkbox, whose single bucket is "people who ticked it". */
  options: Array<{ value: string; label: string }>;
}

/** A field key the operator chose to keep data for after removing the field. */
export interface PersonaRetiredField {
  fieldKey: string;
  /** ISO timestamp the field left the schema. */
  retiredAt: string;
}

// --- Sink-side sanitizer --------------------------------------------------------

function extractStoredSections(raw: unknown): { sections: unknown; savedAt: Date | null } {
  if (Array.isArray(raw)) return { sections: raw, savedAt: null };
  if (raw !== null && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const savedAt = typeof rec.savedAt === 'string' ? new Date(rec.savedAt) : null;
    return {
      sections: rec.sections,
      savedAt: savedAt !== null && !Number.isNaN(savedAt.getTime()) ? savedAt : null,
    };
  }
  return { sections: null, savedAt: null };
}

/**
 * Defence in depth on READ, modelled on `getEmailBranding`, NOT on the raw cast
 * in `getNavItems`.
 *
 * `settings.manage` can still write `instance_settings['persona.sections']`
 * through the generic `PUT /api/admin/settings` route, whose body is
 * `{key: string, value: z.unknown()}`. So the reader re-validates: every section
 * that fails `personaSectionSchema` is dropped (unknown field types, over-long
 * options, unknown properties), and if what survives fails the whole-document
 * `personaSectionsSchema` (duplicate keys across sections, the caps) the whole
 * override is refused and the caller falls back to the config source.
 *
 * Returns `null` when nothing usable is stored. An explicitly stored EMPTY array
 * is a legitimate whole-document override meaning "no sections", and is returned
 * as `[]` rather than falling back.
 */
export function sanitizePersonaSchema(raw: unknown): PersonaSection[] | null {
  const { sections } = extractStoredSections(raw);
  if (!Array.isArray(sections)) return null;
  const kept: PersonaSection[] = [];
  for (const section of sections) {
    const parsed = personaSectionSchema.safeParse(section);
    if (parsed.success) kept.push(parsed.data);
  }
  if (kept.length === 0) return sections.length === 0 ? [] : null;
  const whole = personaSectionsSchema.safeParse(kept);
  return whole.success ? whole.data : null;
}

/**
 * Parse `config.persona`, which `@commonpub/config` carries as an opaque
 * passthrough (plan 14.3: config never learns what a persona section is).
 *
 * Returns the error message rather than throwing, so the admin screen can show
 * an operator that their config file is malformed instead of the persona
 * surface silently serving built-ins.
 */
export function parsePersonaConfig(
  config: CommonPubConfig,
): { config: PersonaConfig | null; error: string | null } {
  if (config.persona === undefined || config.persona === null) {
    return { config: null, error: null };
  }
  const parsed = personaConfigSchema.safeParse(config.persona);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? '';
    return {
      config: null,
      error: `Invalid persona config${path ? ` at ${path}` : ''}: ${first?.message ?? 'unknown error'}`,
    };
  }
  return { config: parsed.data, error: null };
}

// --- Small typed setting readers ------------------------------------------------

function stringRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export interface DriftAck {
  at: string;
  /** Digest of the drift facts that were acknowledged, so a NEW drift re-asks. */
  digest: string;
}

function driftAckRecord(raw: unknown): Record<string, DriftAck> {
  const out: Record<string, DriftAck> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const rec = value as Record<string, unknown>;
    if (typeof rec.at === 'string' && typeof rec.digest === 'string') {
      out[key] = { at: rec.at, digest: rec.digest };
    }
  }
  return out;
}

function fieldLockRecord(raw: unknown): Record<string, PersonaFieldType> {
  const out: Record<string, PersonaFieldType> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const rec = value as Record<string, unknown>;
    if (typeof rec.type === 'string' && isPersonaFieldType(rec.type)) out[key] = rec.type;
  }
  return out;
}

/**
 * Write an instance setting WITHOUT the generic admin audit row.
 *
 * `setInstanceSetting` requires an acting admin and writes a `settings.update`
 * audit entry. The reconciler has neither an actor nor a reason to log a
 * settings change every time it observes the world, so its bookkeeping keys
 * (locks, ack digests) are written directly.
 */
async function putSetting(db: DB, key: string, value: unknown, updatedBy: string | null): Promise<void> {
  await db
    .insert(instanceSettings)
    .values({ key, value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}

/** Field keys whose data the operator chose to KEEP after removing the field. */
export async function getPersonaRetiredFields(db: DB): Promise<PersonaRetiredField[]> {
  const raw = await getInstanceSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY);
  return Object.entries(stringRecord(raw)).map(([fieldKey, retiredAt]) => ({ fieldKey, retiredAt }));
}

/** Mark a field key as retired (its rows stay, it is never counted again). */
export async function setPersonaFieldRetired(
  db: DB,
  fieldKey: string,
  adminId: string | null,
  retiredAt: Date = new Date(),
): Promise<void> {
  const raw = await getInstanceSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY);
  const next = { ...stringRecord(raw), [fieldKey]: retiredAt.toISOString() };
  await putSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY, next, adminId);
  invalidatePersonaSchemaCache(db);
}

/** Drop a field key from the retired list (its rows were purged, or it came back). */
export async function clearPersonaFieldRetired(
  db: DB,
  fieldKey: string,
  adminId: string | null,
): Promise<void> {
  const raw = await getInstanceSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY);
  const next = stringRecord(raw);
  if (!(fieldKey in next)) return;
  delete next[fieldKey];
  await putSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY, next, adminId);
  invalidatePersonaSchemaCache(db);
}

// --- The 60s cache --------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  /** Digest of the CONFIG source. A different config is a different answer. */
  digest: string;
  expiresAt: number;
  value: EffectivePersonaSchema;
}

/**
 * Keyed on the `db` handle, not module-global: a process can hold several
 * databases (every integration test file creates its own PGlite), and a global
 * cache would serve one suite's schema to another.
 */
const schemaCache = new WeakMap<object, CacheEntry>();

function configDigest(config: CommonPubConfig): string {
  return fnv1a32([JSON.stringify(config.persona ?? null)]);
}

/** Drop the cached resolution for this database. Called by every writer here. */
export function invalidatePersonaSchemaCache(db: DB): void {
  schemaCache.delete(db);
}

// --- Drift ----------------------------------------------------------------------

function driftDigest(drifts: readonly PersonaSchemaDrift[]): string {
  return fnv1a32(
    [...drifts]
      .map((d) => `${d.kind}:${d.fieldKey}:${d.detail}`)
      .sort()
      .map((s) => `d:${s}`),
  );
}

export interface StoredCounts {
  /** fieldKey -> option value -> row count, from `user_persona_answers`. */
  answers: Map<string, Map<string, number>>;
  /** fieldKey -> row count, from `user_persona_text`. */
  text: Map<string, number>;
}

async function loadStoredCounts(db: DB): Promise<StoredCounts> {
  const [answerRows, textRows] = await Promise.all([
    db
      .select({
        fieldKey: userPersonaAnswers.fieldKey,
        value: userPersonaAnswers.value,
        count: sql<number>`count(*)::int`,
      })
      .from(userPersonaAnswers)
      .groupBy(userPersonaAnswers.fieldKey, userPersonaAnswers.value),
    db
      .select({
        fieldKey: userPersonaText.fieldKey,
        count: sql<number>`count(*)::int`,
      })
      .from(userPersonaText)
      .groupBy(userPersonaText.fieldKey),
  ]);

  const answers = new Map<string, Map<string, number>>();
  for (const row of answerRows) {
    const byValue = answers.get(row.fieldKey) ?? new Map<string, number>();
    byValue.set(row.value, row.count);
    answers.set(row.fieldKey, byValue);
  }
  const text = new Map<string, number>();
  for (const row of textRows) text.set(row.fieldKey, row.count);
  return { answers, text };
}

function totalAnswerRows(counts: StoredCounts, fieldKey: string): number {
  let total = 0;
  for (const n of counts.answers.get(fieldKey)?.values() ?? []) total += n;
  return total;
}

/**
 * Diff the effective schema against what users actually stored.
 *
 * Pure: it takes the counts, the locks, the acks and the retired list, and
 * returns facts. It never mutates user data, and it never can: a config deploy
 * must not be able to delete a member's answers, so removal is always an
 * explicit operator action (plan 4.6).
 */
export function diffPersonaSchema(args: {
  sections: readonly PersonaSection[];
  counts: StoredCounts;
  locks: Record<string, PersonaFieldType>;
  acks: Record<string, DriftAck>;
  retired: readonly PersonaRetiredField[];
  /**
   * Bucket floor for the reported counts. Defaults to the hard constant rather
   * than the operator's configured value, because this function is pure and has
   * no config; a caller holding the resolved thresholds should pass them.
   */
  minBucket?: number;
}): PersonaSchemaDrift[] {
  const { sections, counts, locks, acks, retired } = args;
  const minBucket = args.minBucket ?? METRICS_MIN_BUCKET;
  const retiredKeys = new Set(retired.map((r) => r.fieldKey));
  const byKey = new Map<string, PersonaField>();
  for (const section of sections) {
    for (const field of section.fields) byKey.set(field.key, field);
  }

  const storedKeys = new Set<string>([...counts.answers.keys(), ...counts.text.keys()]);
  /** Raw, in-process counts. The band is applied once, at the exit below. */
  const raw: Array<Omit<PersonaSchemaDrift, 'acknowledgedAt' | 'affectedRowsBanded'>> = [];

  for (const fieldKey of [...storedKeys].sort()) {
    const answerRows = totalAnswerRows(counts, fieldKey);
    const textRows = counts.text.get(fieldKey) ?? 0;
    const field = byKey.get(fieldKey);

    if (!field) {
      // A key the operator retired on purpose is not drift: they were asked and
      // they answered. Everything else is data the schema can no longer show.
      if (retiredKeys.has(fieldKey)) continue;
      raw.push({
        kind: 'missing_field',
        fieldKey,
        detail: 'This field is no longer in the persona schema, so nobody can see, correct or erase what they answered.',
        affectedRows: answerRows + textRows,
      });
      continue;
    }

    const sink = personaFieldSink(field);
    if (answerRows > 0 && sink !== 'answers') {
      raw.push({
        kind: 'sink_changed',
        fieldKey,
        detail: `Stored selections exist, but this field now stores its answer as "${sink}". The existing rows are in the wrong table.`,
        affectedRows: answerRows,
      });
    }
    if (textRows > 0 && sink !== 'text') {
      raw.push({
        kind: 'sink_changed',
        fieldKey,
        detail: `Stored free text exists, but this field now stores its answer as "${sink}". The existing rows are in the wrong table.`,
        affectedRows: textRows,
      });
    }

    const lock = locks[fieldKey];
    if (lock !== undefined && lock !== field.type) {
      raw.push({
        kind: 'type_changed',
        fieldKey,
        detail: `This field was "${lock}" when its answers were stored and is now "${field.type}".`,
        affectedRows: answerRows + textRows,
      });
    }

    if (sink === 'answers' && personaFieldSpec(field.type).supportsOptions) {
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      const orphaned: string[] = [];
      let orphanedRows = 0;
      for (const [value, count] of counts.answers.get(fieldKey) ?? []) {
        if (allowed.has(value)) continue;
        orphaned.push(value);
        orphanedRows += count;
      }
      if (orphaned.length > 0) {
        // The option VALUES are not named. A per-option census of who chose
        // what is exactly the distribution the metrics module refuses to
        // publish; the operator needs to know a change is destructive and
        // roughly how much, not which nine people picked which option.
        raw.push({
          kind: 'missing_option',
          fieldKey,
          detail: `Stored answers use ${orphaned.length} ${orphaned.length === 1 ? 'option' : 'options'} this field no longer offers.`,
          affectedRows: orphanedRows,
        });
      }
    }
  }

  // An acknowledgement is bound to the drift facts it acknowledged, so a NEW
  // problem on an already-acknowledged key surfaces again rather than inheriting
  // the old "yes, I know".
  const byField = new Map<string, Array<Omit<PersonaSchemaDrift, 'acknowledgedAt' | 'affectedRowsBanded'>>>();
  for (const drift of raw) {
    const list = byField.get(drift.fieldKey) ?? [];
    list.push(drift);
    byField.set(drift.fieldKey, list);
  }

  const out: PersonaSchemaDrift[] = [];
  for (const [fieldKey, drifts] of byField) {
    const ack = acks[fieldKey];
    // The digest is taken over the KIND and the DETAIL only, deliberately not
    // over `affectedRows`: an acknowledgement should not expire because one more
    // person answered, and it should not be a channel for reading the count back
    // out through repeated re-asks.
    const digest = driftDigest(
      drifts.map((d) => ({ ...d, affectedRowsBanded: false, acknowledgedAt: null })),
    );
    const acknowledgedAt = ack !== undefined && ack.digest === digest ? new Date(ack.at) : null;
    for (const drift of drifts) {
      const band = bandPersonaCount(drift.affectedRows, minBucket);
      out.push({
        ...drift,
        affectedRows: band.value,
        affectedRowsBanded: band.banded,
        acknowledgedAt,
      });
    }
  }
  return out;
}

/**
 * The audit actor for a reconciler that nobody triggered.
 *
 * `audit_logs.user_id` is NOT NULL and references `users`, so a boot-time drift
 * row needs a real person. The earliest admin is the one accountable for the
 * config file that caused the drift. When an instance has no admin at all there
 * is nobody to notify, so the audit row is skipped; the drift is still returned
 * by `effectivePersonaSchema` and still excludes the field from the aggregatable
 * list, which is the part that protects the data.
 */
async function resolveDriftAuditActor(db: DB): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
    .orderBy(asc(users.createdAt), asc(users.id))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Write one `audit_logs` row per drift, at most once per distinct drift set.
 *
 * The last audited digest is stored, so a reconciler that runs on every cache
 * miss does not re-log the same finding every 60 seconds, and a restart does not
 * duplicate it either.
 */
async function auditDrift(db: DB, drifts: readonly PersonaSchemaDrift[]): Promise<void> {
  const digest = driftDigest(drifts);
  const previous = await getInstanceSetting(db, PERSONA_DRIFT_AUDITED_SETTING_KEY);
  if (typeof previous === 'string' && previous === digest) return;

  if (drifts.length > 0) {
    const actorId = await resolveDriftAuditActor(db);
    if (actorId === null) return;
    await db.insert(auditLogs).values(
      drifts.map((drift) => ({
        userId: actorId,
        action: PERSONA_AUDIT_ACTIONS.drift,
        targetType: 'persona_field',
        targetId: drift.fieldKey,
        metadata: {
          kind: drift.kind,
          detail: drift.detail,
          affectedRows: drift.affectedRows,
        },
        ipAddress: null,
      })),
    );
  }
  await putSetting(db, PERSONA_DRIFT_AUDITED_SETTING_KEY, digest, null);
}

/**
 * Record the type a field had when its first answers were stored.
 *
 * Written once per key and then never rewritten by a read, which is what makes
 * `type_changed` detectable at all: a config file that turns a `multiselect`
 * into a `text` field carries no record of what it used to be. Only an explicit
 * operator action (a schema save, or acknowledging the drift) moves a lock.
 */
async function seedFieldLocks(
  db: DB,
  sections: readonly PersonaSection[],
  counts: StoredCounts,
  locks: Record<string, PersonaFieldType>,
): Promise<void> {
  const stored = new Set<string>([...counts.answers.keys(), ...counts.text.keys()]);
  const next: Record<string, { type: PersonaFieldType }> = {};
  for (const [key, type] of Object.entries(locks)) next[key] = { type };
  let changed = false;
  for (const section of sections) {
    for (const field of section.fields) {
      if (!stored.has(field.key)) continue;
      if (locks[field.key] !== undefined) continue;
      next[field.key] = { type: field.type };
      changed = true;
    }
  }
  if (!changed) return;
  await putSetting(db, PERSONA_FIELD_LOCKS_SETTING_KEY, next, null);
}

// --- Resolution -----------------------------------------------------------------

async function resolvePersonaSchema(
  db: DB,
  config: CommonPubConfig,
): Promise<EffectivePersonaSchema> {
  const [storedRaw, locksRaw, acksRaw, retired] = await Promise.all([
    getInstanceSetting(db, PERSONA_SECTIONS_SETTING_KEY),
    getInstanceSetting(db, PERSONA_FIELD_LOCKS_SETTING_KEY),
    getInstanceSetting(db, PERSONA_DRIFT_ACK_SETTING_KEY),
    getPersonaRetiredFields(db),
  ]);

  const dbSections = storedRaw === null ? null : sanitizePersonaSchema(storedRaw);
  const { savedAt } = extractStoredSections(storedRaw);
  const fileSections = parsePersonaConfig(config).config?.sections ?? [];

  let sections: PersonaSection[];
  let source: EffectivePersonaSchema['source'];
  if (dbSections !== null) {
    sections = dbSections;
    source = 'database';
  } else if (fileSections.length > 0) {
    sections = fileSections;
    source = 'config';
  } else {
    // The built-ins are readonly by design; the caller gets its own copy.
    sections = BUILTIN_PERSONA_SECTIONS.map((s) => ({ ...s, fields: [...s.fields] }));
    source = 'builtin';
  }

  // `order` is honoured HERE, once, rather than by each renderer. It is
  // validated (0..999), set on all three built-in sections and round-tripped by
  // the admin editor, and until this sort existed nothing read it: an operator
  // could set it and see nothing move. A stable sort keeps declaration order for
  // sections that share an order or declare none.
  sections = sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => (a.section.order ?? 500) - (b.section.order ?? 500) || a.index - b.index)
    .map((entry) => entry.section);

  const counts = await loadStoredCounts(db);
  const locks = fieldLockRecord(locksRaw);
  const drift = diffPersonaSchema({
    sections,
    counts,
    locks,
    acks: driftAckRecord(acksRaw),
    retired,
  });

  await seedFieldLocks(db, sections, counts, locks);
  await auditDrift(db, drift);

  return {
    sections,
    source,
    savedAt: source === 'database' ? savedAt : null,
    drift,
  };
}

/**
 * The effective persona schema for this instance, with its provenance and its
 * drift (plan 5.3, 5.3.1).
 *
 * Cached for 60 seconds per database, keyed on a digest of the config source, and
 * invalidated by every writer in this module. A write through the GENERIC
 * settings route is not seen by that invalidation, which is one more reason the
 * dedicated admin route exists.
 */
export async function effectivePersonaSchema(
  db: DB,
  config: CommonPubConfig,
): Promise<EffectivePersonaSchema> {
  const digest = configDigest(config);
  const cached = schemaCache.get(db);
  if (cached !== undefined && cached.digest === digest && cached.expiresAt > Date.now()) {
    return structuredClone(cached.value);
  }
  const value = await resolvePersonaSchema(db, config);
  schemaCache.set(db, { digest, expiresAt: Date.now() + CACHE_TTL_MS, value });
  return structuredClone(value);
}

/** The effective link platform set: built-ins, then the config file, then the DB. */
export async function effectivePersonaLinkPlatforms(
  db: DB,
  config: CommonPubConfig,
): Promise<readonly PersonaLinkPlatformSpec[]> {
  const fromConfig = parsePersonaConfig(config).config?.linkPlatforms ?? [];
  const raw = await getInstanceSetting(db, PERSONA_LINK_PLATFORMS_SETTING_KEY);
  const fromDb: PersonaLinkPlatformSpec[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const parsed = personaLinkPlatformSchema.safeParse(entry);
      if (parsed.success) fromDb.push(parsed.data);
    }
  }
  // Dedupe order is deliberate: a built-in can never be redefined, and the file
  // beats the DB for a platform declared in both.
  return effectiveLinkPlatforms([...fromConfig, ...fromDb]);
}

// --- The aggregatable list ------------------------------------------------------

/**
 * Every field that can become an aggregate bucket right now.
 *
 * Four exclusions, each load bearing:
 * - not aggregatable by `isPersonaFieldAggregatable` (free text can never be counted);
 * - `sensitive`, which the Art. 9 escape hatch already forces into the text sink;
 * - retired, so nothing keeps counting a question the operator withdrew;
 * - DRIFTED and not yet acknowledged, so a silent key rename cannot quietly drop
 *   a cohort to zero while the endpoint keeps answering (plan 5.3.1 step 3).
 */
export async function listPersonaAggregatableFields(
  db: DB,
  config: CommonPubConfig,
): Promise<PersonaAggregatableField[]> {
  const [{ sections, drift }, retired] = await Promise.all([
    effectivePersonaSchema(db, config),
    getPersonaRetiredFields(db),
  ]);
  const blocked = new Set<string>(
    drift.filter((d) => d.acknowledgedAt === null).map((d) => d.fieldKey),
  );
  for (const r of retired) blocked.add(r.fieldKey);

  const out: PersonaAggregatableField[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      if (blocked.has(field.key)) continue;
      if (field.sensitive === true) continue;
      if (!isPersonaFieldAggregatable(field)) continue;
      out.push({
        key: field.key,
        label: field.label,
        sectionKey: section.key,
        sectionLabel: section.label,
        type: field.type,
        maxSelections: field.maxSelections ?? null,
        options: (field.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      });
    }
  }
  return out;
}

// --- Writers --------------------------------------------------------------------

/**
 * Save the whole-document admin override.
 *
 * Re-validates with the same schema the reader uses, stamps the provenance row
 * (plan 5.3.2) and refreshes the type locks: an explicit save IS the operator
 * declaring what the field types are, so it clears a `type_changed` drift that
 * the route has already made them decide about.
 */
export async function savePersonaSchemaOverride(
  db: DB,
  args: { sections: PersonaSection[]; adminId: string; ip?: string | null },
): Promise<{ ok: true; savedAt: Date } | { ok: false; error: string }> {
  const parsed = personaSectionsSchema.safeParse(args.sections);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? 'Invalid persona schema' };
  }
  const savedAt = new Date();
  const stored: StoredPersonaSchema = {
    source: 'admin',
    savedAt: savedAt.toISOString(),
    sections: parsed.data,
  };
  await putSetting(db, PERSONA_SECTIONS_SETTING_KEY, stored, args.adminId);

  const locks: Record<string, { type: PersonaFieldType }> = {};
  for (const section of parsed.data) {
    for (const field of section.fields) locks[field.key] = { type: field.type };
  }
  await putSetting(db, PERSONA_FIELD_LOCKS_SETTING_KEY, locks, args.adminId);

  // A key PRESENT in the saved document is not retired, whatever an earlier save
  // recorded. Without this, retiring a field and later re-adding it left it in
  // `persona.retiredFields` forever, which is a permanent block in
  // `listPersonaAggregatableFields`: the only way back was to delete every
  // member's answers to it. Retirement means "this question left the schema", so
  // the question returning is what ends it.
  const retiredRaw = await getInstanceSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY);
  const retired = stringRecord(retiredRaw);
  let unretired = false;
  for (const key of Object.keys(locks)) {
    if (key in retired) {
      delete retired[key];
      unretired = true;
    }
  }
  if (unretired) await putSetting(db, PERSONA_RETIRED_FIELDS_SETTING_KEY, retired, args.adminId);

  await db.insert(auditLogs).values({
    userId: args.adminId,
    action: PERSONA_AUDIT_ACTIONS.save,
    targetType: 'persona_schema',
    targetId: PERSONA_SECTIONS_SETTING_KEY,
    metadata: { sections: parsed.data.length },
    ipAddress: args.ip ?? null,
  });

  invalidatePersonaSchemaCache(db);
  return { ok: true, savedAt };
}

/**
 * Remove the DB override so `commonpub.config.ts` is authoritative again.
 *
 * This is the revert path `PUT /api/admin/features` never had: a portal-touched
 * flag there can never be won back by the git file (plan 5.3.2).
 */
export async function clearPersonaSchemaOverride(
  db: DB,
  args: { adminId: string; ip?: string | null },
): Promise<{ removed: boolean }> {
  const existing = await getInstanceSetting(db, PERSONA_SECTIONS_SETTING_KEY);
  if (existing === null) return { removed: false };
  await db.delete(instanceSettings).where(eq(instanceSettings.key, PERSONA_SECTIONS_SETTING_KEY));
  await db.insert(auditLogs).values({
    userId: args.adminId,
    action: PERSONA_AUDIT_ACTIONS.revert,
    targetType: 'persona_schema',
    targetId: PERSONA_SECTIONS_SETTING_KEY,
    metadata: null,
    ipAddress: args.ip ?? null,
  });
  invalidatePersonaSchemaCache(db);
  return { removed: true };
}

/**
 * Acknowledge the CURRENT drift on one field key.
 *
 * The acknowledgement stores the digest of what was acknowledged, so it stops
 * excluding the field from the aggregatable list without also silencing a
 * different problem that appears later. It never touches user data: purging or
 * retaining rows is `purgePersonaField` / `retirePersonaField` in `values.ts`.
 */
export async function acknowledgePersonaDrift(
  db: DB,
  config: CommonPubConfig,
  args: { fieldKey: string; adminId: string; ip?: string | null },
): Promise<{ ok: true; acknowledged: PersonaSchemaDrift[] } | { ok: false; error: string }> {
  const { sections, drift } = await effectivePersonaSchema(db, config);
  const forField = drift.filter((d) => d.fieldKey === args.fieldKey);
  if (forField.length === 0) return { ok: false, error: 'No drift is recorded for that field' };

  const acksRaw = await getInstanceSetting(db, PERSONA_DRIFT_ACK_SETTING_KEY);
  const acks = driftAckRecord(acksRaw);
  const at = new Date();
  acks[args.fieldKey] = {
    at: at.toISOString(),
    digest: driftDigest(forField.map((d) => ({ ...d, acknowledgedAt: null }))),
  };
  await putSetting(db, PERSONA_DRIFT_ACK_SETTING_KEY, acks, args.adminId);

  // The operator has now looked at this field, so its lock follows the schema.
  const field = sections.flatMap((s) => s.fields).find((f) => f.key === args.fieldKey);
  if (field !== undefined) {
    const locksRaw = await getInstanceSetting(db, PERSONA_FIELD_LOCKS_SETTING_KEY);
    const locks: Record<string, { type: PersonaFieldType }> = {};
    for (const [key, type] of Object.entries(fieldLockRecord(locksRaw))) locks[key] = { type };
    locks[args.fieldKey] = { type: field.type };
    await putSetting(db, PERSONA_FIELD_LOCKS_SETTING_KEY, locks, args.adminId);
  }

  await db.insert(auditLogs).values({
    userId: args.adminId,
    action: PERSONA_AUDIT_ACTIONS.acknowledge,
    targetType: 'persona_field',
    targetId: args.fieldKey,
    metadata: { kinds: forField.map((d) => d.kind) },
    ipAddress: args.ip ?? null,
  });

  invalidatePersonaSchemaCache(db);
  return { ok: true, acknowledged: forField.map((d) => ({ ...d, acknowledgedAt: at })) };
}
