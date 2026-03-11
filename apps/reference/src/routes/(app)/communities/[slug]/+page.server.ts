import { error, fail } from '@sveltejs/kit';
import {
  getCommunityBySlug,
  joinCommunity,
  leaveCommunity,
  createPost,
  shareContent,
  listPosts,
  listMembers,
  deletePost,
  togglePinPost,
  toggleLockPost,
} from '$lib/server/community';
import { communityPosts } from '@snaplify/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  if (!event.locals.config.features.communities) {
    error(404, 'Communities are not enabled');
  }

  const community = await getCommunityBySlug(
    event.locals.db,
    event.params.slug,
    event.locals.user?.id,
  );

  if (!community) {
    error(404, 'Community not found');
  }

  const [{ items: posts, total: postTotal }, members] = await Promise.all([
    listPosts(event.locals.db, community.id, {
      limit: 20,
      offset: parseInt(event.url.searchParams.get('offset') ?? '0', 10),
    }),
    listMembers(event.locals.db, community.id),
  ]);

  return { community, posts, postTotal, members };
};

export const actions: Actions = {
  join: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const inviteToken = (data.get('inviteToken') as string) || undefined;

    const result = await joinCommunity(locals.db, locals.user.id, community.id, inviteToken);
    if (!result.joined) {
      return fail(400, { error: result.error ?? 'Could not join' });
    }

    return { success: true };
  },

  leave: async ({ params, locals }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const result = await leaveCommunity(locals.db, locals.user.id, community.id);
    if (!result.left) {
      return fail(400, { error: result.error ?? 'Could not leave' });
    }

    return { success: true };
  },

  createPost: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const content = data.get('content') as string;
    const type = (data.get('type') as string) || 'text';
    const sharedContentId = data.get('sharedContentId') as string | null;
    const pollOptionValues = data.getAll('pollOptions') as string[];
    const pollMultiSelect = data.get('pollMultiSelect') === 'on';

    if (type === 'share' && sharedContentId) {
      const result = await shareContent(locals.db, locals.user.id, community.id, sharedContentId);
      if (!result) {
        return fail(400, { error: 'Could not share content' });
      }
      return { success: true };
    }

    if (type === 'poll' && pollOptionValues.length >= 2) {
      const pollData = {
        question: content,
        options: pollOptionValues.map((text) => ({ text, votes: 0 })),
        multiSelect: pollMultiSelect,
      };
      // Store poll data as JSON in content
      await createPost(locals.db, locals.user.id, {
        communityId: community.id,
        type: 'poll',
        content: JSON.stringify(pollData),
      });
      return { success: true };
    }

    if (!content?.trim()) {
      return fail(400, { error: 'Content is required' });
    }

    try {
      await createPost(locals.db, locals.user.id, {
        communityId: community.id,
        type,
        content,
      });
      return { success: true };
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
  },

  deletePost: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const postId = data.get('postId') as string;

    const deleted = await deletePost(locals.db, postId, locals.user.id, community.id);
    if (!deleted) {
      return fail(403, { error: 'Not authorized to delete this post' });
    }

    return { success: true };
  },

  pinPost: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const postId = data.get('postId') as string;

    const result = await togglePinPost(locals.db, postId, locals.user.id, community.id);
    if (!result) {
      return fail(403, { error: 'Not authorized to pin posts' });
    }

    return { success: true, pinned: result.pinned };
  },

  lockPost: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const postId = data.get('postId') as string;

    const result = await toggleLockPost(locals.db, postId, locals.user.id, community.id);
    if (!result) {
      return fail(403, { error: 'Not authorized to lock posts' });
    }

    return { success: true, locked: result.locked };
  },

  votePoll: async ({ params, locals, request }) => {
    if (!locals.user) return fail(401, { error: 'Not authenticated' });

    const community = await getCommunityBySlug(locals.db, params.slug);
    if (!community) return fail(404, { error: 'Community not found' });

    const data = await request.formData();
    const postId = data.get('postId') as string;
    const optionIndex = parseInt(data.get('optionIndex') as string, 10);

    if (!postId || isNaN(optionIndex)) {
      return fail(400, { error: 'Invalid vote' });
    }

    // Get the post
    const posts = await locals.db
      .select({ content: communityPosts.content, type: communityPosts.type })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (posts.length === 0 || posts[0]!.type !== 'poll') {
      return fail(400, { error: 'Post is not a poll' });
    }

    try {
      const pollData = JSON.parse(posts[0]!.content);
      if (optionIndex < 0 || optionIndex >= pollData.options.length) {
        return fail(400, { error: 'Invalid option' });
      }

      pollData.options[optionIndex].votes += 1;

      await locals.db
        .update(communityPosts)
        .set({ content: JSON.stringify(pollData), updatedAt: new Date() })
        .where(eq(communityPosts.id, postId));

      return { success: true };
    } catch {
      return fail(400, { error: 'Invalid poll data' });
    }
  },
};
