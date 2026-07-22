import { deleteUser } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<void> => {
  requireFeature('admin');
  const admin = requirePermission(event, 'users.delete');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Capture the user's PRIVATE storage keys BEFORE the DB cascade wipes the files
  // rows, then purge those bytes AFTER (private PII uploads would otherwise orphan —
  // GDPR erasure). Public files are intentionally left (see purgeUserFiles).
  const keys = await collectUserPrivateFileKeys(db, id);
  await deleteUser(db, id, admin.id);
  await deleteUserPrivateFileBytes(keys);
});
