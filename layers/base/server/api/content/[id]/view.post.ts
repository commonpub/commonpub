import { incrementViewCount, getClientIp } from '@commonpub/server';

// Simple in-memory dedup — tracks IP+contentId pairs for 5 minutes
const recentViews = new Map<string, number>();
const VIEW_COOLDOWN_MS = 5 * 60 * 1000;

// Periodic cleanup every 2 minutes. `.unref()` so this interval doesn't
// hold the event loop on shutdown — Nitro's graceful-exit path shouldn't
// have to wait on a view-dedup timer.
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentViews) {
    if (now - ts > VIEW_COOLDOWN_MS) recentViews.delete(key);
  }
}, 120_000).unref();

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // De-duplicate views per IP + content within cooldown window. Use the
  // trusted (rightmost) XFF token (federation-hardening Item 9) — the
  // previous leftmost-token read let any anonymous caller rotate
  // `X-Forwarded-For: random` to inflate view counts past the 5-min cap.
  const ip = getClientIp(event);
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
