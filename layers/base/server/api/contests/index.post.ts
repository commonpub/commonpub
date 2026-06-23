import { createContest, getContestBySlug } from '@commonpub/server';
import type { ContestDetail, CreateContestInput } from '@commonpub/server';
import { createContestSchema } from '@commonpub/schema';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createContestSchema);

  // Manual slug override (slugified defensively) falls back to the title.
  const base = slugify(input.slug || input.title) || `contest-${Date.now()}`;
  // Ensure slug uniqueness so a duplicate title returns a clean contest instead
  // of a 500 from the unique-constraint violation.
  let slug = base;
  for (let n = 2; n <= 50 && (await getContestBySlug(db, slug)); n++) {
    slug = `${base}-${n}`;
  }

  return createContest(db, { ...input, slug, createdBy: user.id } as CreateContestInput, {
    userRole: user.role,
    contestCreationPolicy: config.instance.contestCreation ?? 'admin',
  });
});
