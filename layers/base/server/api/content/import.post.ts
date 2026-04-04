import { importFromUrl } from '@commonpub/server/import';
import type { ImportResult } from '@commonpub/server/import';
import { z } from 'zod';

const importBodySchema = z.object({
  url: z.string().url(),
});

export default defineEventHandler(async (event): Promise<ImportResult> => {
  requireAuth(event);

  const { url } = await parseBody(event, importBodySchema);

  try {
    return await importFromUrl(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import failed';

    if (message.includes('private') || message.includes('reserved')) {
      throw createError({ statusCode: 400, statusMessage: message });
    }
    if (message === 'Invalid URL' || message.includes('must use HTTP')) {
      throw createError({ statusCode: 400, statusMessage: message });
    }
    if (message.includes('HTTP ')) {
      throw createError({ statusCode: 502, statusMessage: `Failed to fetch URL: ${message}` });
    }
    if (message.includes('Too many redirects') || message.includes('too large')) {
      throw createError({ statusCode: 400, statusMessage: message });
    }

    throw createError({ statusCode: 500, statusMessage: 'Content import failed' });
  }
});
