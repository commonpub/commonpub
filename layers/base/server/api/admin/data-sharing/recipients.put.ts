/**
 * PUT /api/admin/data-sharing/recipients
 *
 * Replace the DATABASE half of the recipient list (member-visibility plan
 * section 6). The config-file half is not writable from here and never will be:
 * it is under review in git and it wins a collision on `id`.
 *
 * WHOLE LIST, ALL OR NOTHING. `setStoredRecipients` owns that rule and the
 * reason for it: a partial write would leave the instance disclosing to a
 * recipient the operator believed they had removed. This route adds no
 * validation of its own beyond the envelope, because a second copy of
 * `dataRecipientSchema`'s rules here is a second thing to drift, and the rules
 * that matter (a privacy policy URL is required; a joint or independent
 * controller with no `agreementRef` is refused) are exactly the ones that must
 * not be re-implemented loosely.
 *
 * NEVER `PUT /api/admin/settings`. That route takes `{ key, value: z.unknown() }`
 * and would write this list past every one of those refusals.
 *
 * THE COST THIS ROUTE IMPOSES, reported rather than hidden. The recipient ids
 * are an input to the consent scope digest, so adding or removing one moves the
 * digest and degrades every existing grant to "needs reconfirmation": members
 * are asked again before anything is disclosed to the new list. The response
 * carries the digest before and after so the page can tell the operator whether
 * that just happened, rather than leaving them to discover it from a support
 * ticket. The digest is computed over the file UNION database list through
 * `effectiveDataSharingDocument`, which is the same document the consent surface
 * should resolve, so the two agree.
 *
 * An EMPTY array removes the stored row entirely rather than storing `[]`. Both
 * produce the same union, and the revert path (`clearStoredRecipients`) is the
 * one that leaves no empty artifact behind for the next operator to puzzle over.
 * This is the revert `PUT /api/admin/features` never had.
 *
 * The audit row is written by `setStoredRecipients` / `clearStoredRecipients`
 * and carries the ids ADDED and REMOVED, not a count: "who did we start sending
 * members' data to, and when" is what it exists to answer.
 */
import {
  clearStoredRecipients,
  currentPurposeScope,
  effectiveDataSharingDocument,
  getStoredRecipients,
  setStoredRecipients,
  MAX_STORED_RECIPIENTS,
} from '@commonpub/server';
import type { DataRecipient } from '@commonpub/persona';
import { z } from 'zod';

/**
 * The ENVELOPE only. Every element stays `unknown` on purpose so
 * `dataRecipientSchema` inside `setStoredRecipients` is the single thing that
 * decides what a recipient is, and its error (with the offending index and
 * field path) is what reaches the operator.
 */
const bodySchema = z.object({
  recipients: z.array(z.unknown()).max(MAX_STORED_RECIPIENTS),
});

export interface AdminDataSharingRecipientsPutResponse {
  storedRecipients: DataRecipient[];
  /** True when the stored row was removed because the list was emptied. */
  cleared: boolean;
  /** The effective (file union database) consent scope digest before the write. */
  previousScopeDigest: string;
  scopeDigest: string;
  /**
   * The digest moved, so every existing grant is now stale and members will be
   * asked again before anything is disclosed. Derived, so the page cannot say
   * it happened when it did not.
   */
  grantsNeedReconfirmation: boolean;
}

export default defineEventHandler(
  async (event): Promise<AdminDataSharingRecipientsPutResponse> => {
    requireFeature('admin');
    requireFeature('persona');
    const admin = requirePermission(event, 'settings.manage');

    const db = useDB();
    const config = useConfig();

    const body = await readBody(event);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid input',
        data: parsed.error.flatten(),
      });
    }

    // Before the write, so the comparison is against what was actually in force
    // rather than against what the page last rendered.
    const before = await currentPurposeScope(db, config, {
      dataSharing: effectiveDataSharingDocument,
    });

    const ip = getRequestIP(event) ?? null;
    let cleared = false;

    if (parsed.data.recipients.length === 0) {
      const result = await clearStoredRecipients(db, admin.id, { ip });
      cleared = result.removed;
    } else {
      const result = await setStoredRecipients(db, admin.id, parsed.data.recipients, { ip });
      if (!result.ok) {
        // The message names the index and the field path, which is the whole
        // point of refusing the list rather than repairing it.
        throw createError({ statusCode: 400, statusMessage: result.error });
      }
    }

    const [storedRecipients, after] = await Promise.all([
      getStoredRecipients(db),
      currentPurposeScope(db, config, { dataSharing: effectiveDataSharingDocument }),
    ]);

    return {
      storedRecipients,
      cleared,
      previousScopeDigest: before.digest,
      scopeDigest: after.digest,
      grantsNeedReconfirmation: before.digest !== after.digest,
    };
  },
);
