import { setInstanceSetting } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const body = await readBody(event);

  return setInstanceSetting(db, body.key, body.value);
});
