import { getEventBySlug, toPublicEvent, isPublicEvent, type PublicEventRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:events');
  requireFeature('events');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });
  const db = useDB();
  const config = useConfig();
  const row = await getEventBySlug(db, slug);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  const casted = row as unknown as PublicEventRow;
  if (!isPublicEvent(casted)) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  return toPublicEvent(casted, config.instance.domain);
});
