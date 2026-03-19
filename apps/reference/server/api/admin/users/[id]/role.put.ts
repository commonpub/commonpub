import { updateUserRole } from '@commonpub/server';
import { adminUpdateRoleSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<void> => {
  const admin = requireAdmin(event);
  const db = useDB();
  const id = getRouterParam(event, 'id')!;
  const body = await readBody(event);

  const parsed = adminUpdateRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return updateUserRole(db, id, parsed.data.role, admin.id);
});
