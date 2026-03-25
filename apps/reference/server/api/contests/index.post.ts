import { createContest } from '@commonpub/server';
import type { ContestDetail, CreateContestInput } from '@commonpub/server';
import { createContestSchema } from '@commonpub/schema';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createContestSchema);

  const slug = slugify(input.title) || `contest-${Date.now()}`;

  return createContest(db, { ...input, slug, createdBy: user.id } as CreateContestInput, {
    userRole: user.role,
    contestCreationPolicy: config.instance.contestCreation ?? 'staff',
  });
});
