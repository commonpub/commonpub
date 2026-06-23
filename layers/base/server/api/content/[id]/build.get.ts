import { isBuildMarked } from '@commonpub/server';

// Hydration counterpart to build.post.ts (which TOGGLES): lets the content view
// show the correct "I Built This" state on load, so a reload doesn't render the
// button inactive and a re-click doesn't silently un-mark + decrement the count.
export default defineEventHandler(async (event): Promise<{ marked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  return { marked: await isBuildMarked(db, id, user.id) };
});
