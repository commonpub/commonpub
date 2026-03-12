import { processInboxActivity } from '@commonpub/protocol';

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const body = await readBody(event);

  try {
    await processInboxActivity(body);
    return { status: 'accepted' };
  } catch (err: unknown) {
    console.error('[inbox]', err);
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity' });
  }
});
