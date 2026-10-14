import { deleteUser, findSharedOwnership, describeSharedOwnership } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'users.delete');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Deleting an owner used to cascade through their contests and hubs, taking
  // everyone else's entries and posts with them (session 262). Refuse instead.
  const owned = await findSharedOwnership(db, id);
  if (Object.values(owned).some((n) => n > 0)) {
    throw createError({
      statusCode: 409,
      statusMessage: `This account still owns ${describeSharedOwnership(owned)}. Reassign or remove them first.`,
      data: { owned },
    });
  }

  // Capture the user's PRIVATE storage keys BEFORE the DB cascade wipes the files
  // rows, then purge those bytes AFTER (private PII uploads would otherwise orphan —
  // GDPR erasure). Public files are intentionally left (see purgeUserFiles).
  const keys = await collectUserPrivateFileKeys(db, id);
  await deleteUser(db, id, admin.id);
  await deleteUserPrivateFileBytes(keys);
});
