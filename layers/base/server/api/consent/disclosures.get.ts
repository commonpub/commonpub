/**
 * GET /api/consent/disclosures — who has looked at the viewer through the
 * member visibility directory (directory plan D6, section 5.2).
 *
 * The accountability record is worth more to the member than to the operator.
 * D5 says a revocation removes you from the NEXT response and cannot recall what
 * was already shared, which is only an honest thing to say if the member can see
 * what was already shared. This route is that half of the deal.
 *
 * SCOPED BY THE SESSION, NEVER BY A PARAMETER. There is no `userId` input of any
 * kind: not a query string, not a body, not a route param. The handler reads
 * `requireAuth(event).id` and nothing else, so there is no version of this
 * endpoint that answers "who looked at someone else". A parameter that is
 * validated against the session is one refactor away from being validated
 * against nothing; a parameter that does not exist is not.
 *
 * ONE ROW PER RECIPIENT, not per disclosure. `listDisclosuresForMember` groups
 * by (recipient, purpose) because the purpose is what authorised the read;
 * the member's question is "who, how often, how recently", so the purposes are
 * folded together here and the purposes that contributed are carried alongside
 * for the reader who wants them. A recruiter paging through the directory four
 * times a day would otherwise bury the one fact that matters.
 *
 * NAMES ARE RESOLVED, NEVER INVENTED. `disclosure_events.recipient_id` is
 * deliberately not a foreign key: recipients are config and instance-settings
 * data, not a table, and an operator who removes one must not thereby erase the
 * record that a disclosure happened. When the id no longer resolves, the row is
 * still returned with `recipientKnown: false` and the raw id as its name, so the
 * page can say "a recipient that is no longer listed" rather than silently
 * dropping a disclosure out of what is effectively a legal record.
 *
 * FLAGGED on `memberDirectory`, which `requireFeature` turns into a 404 rather
 * than a 403: an instance that does not run the directory does not reveal that
 * the surface exists. Note the consequence, which is deliberate and is stated in
 * the purge worker too: turning the flag off hides a member's own history from
 * them while the rows still exist. The alternative (an unflagged route on every
 * instance) would answer a question about a feature that instance does not have.
 */
import { effectiveRecipients, listDisclosuresForMember } from '@commonpub/server';

/** One recipient's use of the directory against the viewer. */
export interface MemberDisclosureRow {
  /** The declared recipient id from `dataSharing.recipients`. */
  recipientId: string;
  /** The recipient's declared name, or the raw id when it no longer resolves. */
  recipientName: string;
  /** False when no declared recipient carries this id any more. Never hidden. */
  recipientKnown: boolean;
  /** Purposes that authorised these reads, sorted. Usually one. */
  purposes: string[];
  /** How many times this recipient has been given this member's row. */
  count: number;
  /**
   * ISO 8601. Never a locale string: a server-formatted date is rendered in the
   * server's timezone and mismatches the browser's on hydration in production
   * only, which is the one place it is not observed.
   */
  lastDisclosedAt: string;
}

export interface MemberDisclosuresPayload {
  disclosures: MemberDisclosureRow[];
}

export default defineEventHandler(async (event): Promise<MemberDisclosuresPayload> => {
  requireFeature('memberDirectory');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();

  const [rows, recipients] = await Promise.all([
    listDisclosuresForMember(db, user.id),
    effectiveRecipients(db, config),
  ]);

  const names = new Map(recipients.map((r) => [r.id, r.name]));

  const byRecipient = new Map<string, MemberDisclosureRow>();
  for (const row of rows) {
    const existing = byRecipient.get(row.recipientId);
    if (!existing) {
      const name = names.get(row.recipientId);
      byRecipient.set(row.recipientId, {
        recipientId: row.recipientId,
        recipientName: name ?? row.recipientId,
        recipientKnown: name !== undefined,
        purposes: [row.purpose],
        count: row.count,
        lastDisclosedAt: row.lastDisclosedAt.toISOString(),
      });
      continue;
    }
    existing.count += row.count;
    if (!existing.purposes.includes(row.purpose)) existing.purposes.push(row.purpose);
    if (row.lastDisclosedAt.toISOString() > existing.lastDisclosedAt) {
      existing.lastDisclosedAt = row.lastDisclosedAt.toISOString();
    }
  }

  const disclosures = [...byRecipient.values()].map((row) => ({
    ...row,
    purposes: [...row.purposes].sort(),
  }));

  // Most recent first, with the id as a unique tiebreaker so two disclosures
  // that share a timestamp still have one order rather than whichever the
  // grouping happened to produce.
  disclosures.sort((a, b) => {
    if (a.lastDisclosedAt !== b.lastDisclosedAt) {
      return a.lastDisclosedAt < b.lastDisclosedAt ? 1 : -1;
    }
    return a.recipientId.localeCompare(b.recipientId);
  });

  return { disclosures };
});
