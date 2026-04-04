import { exportUserData } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();

  const data = await exportUserData(db, user.id);

  const filename = `commonpub-export-${user.username}-${new Date().toISOString().split('T')[0]}.json`;

  setHeader(event, 'Content-Type', 'application/json');
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

  return data;
});
