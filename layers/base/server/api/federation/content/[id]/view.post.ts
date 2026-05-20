import { incrementFederatedViewCount, getClientIp } from '@commonpub/server';

const recentViews = new Map<string, number>();
const VIEW_COOLDOWN_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentViews) {
    if (now - ts > VIEW_COOLDOWN_MS) recentViews.delete(key);
  }
}, 120_000);

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('federation');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  // Trusted client IP for view dedup (federation-hardening Item 9 — see
  // sibling content/view.post.ts).
  const ip = getClientIp(event);
  const dedupKey = `fed:${ip}:${id}`;
  const lastView = recentViews.get(dedupKey);

  if (lastView && Date.now() - lastView < VIEW_COOLDOWN_MS) {
    return { success: true };
  }

  recentViews.set(dedupKey, Date.now());
  await incrementFederatedViewCount(db, id);
  return { success: true };
});
