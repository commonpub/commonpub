import { setInstanceSetting } from '@commonpub/server';
import { adminSettingSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  const admin = requireAdmin(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = adminSettingSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return setInstanceSetting(db, parsed.data.key, parsed.data.value, admin.id);
});
