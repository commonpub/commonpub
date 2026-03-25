import { incrementViewCount } from '@commonpub/server';

// Simple in-memory dedup — tracks IP+contentId pairs for 5 minutes
const recentViews = new Map<string, number>();
const VIEW_COOLDOWN_MS = 5 * 60 * 1000;

// Periodic cleanup every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentViews) {
    if (now - ts > VIEW_COOLDOWN_MS) recentViews.delete(key);
  }
}, 120_000);

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // De-duplicate views per IP + content within cooldown window
  const ip = getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || getRequestHeader(event, 'x-real-ip')
    || 'unknown';
  const dedupKey = `${ip}:${id}`;
  const lastView = recentViews.get(dedupKey);

  if (lastView && Date.now() - lastView < VIEW_COOLDOWN_MS) {
    // Already counted recently — skip but return success
    return { success: true };
  }

  recentViews.set(dedupKey, Date.now());
  await incrementViewCount(db, id);
  return { success: true };
});
