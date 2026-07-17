import { describe, it, expect, vi } from 'vitest';
import { processInboxActivity, type InboxCallbacks } from '../inbox';

function createMockCallbacks(): InboxCallbacks {
  return {
    onFollow: vi.fn(),
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onUndo: vi.fn(),
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onLike: vi.fn(),
    onAnnounce: vi.fn(),
  };
}

describe('processInboxActivity', () => {
  it('should process Follow activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Follow',
        id: 'https://remote.com/activities/1',
        actor: 'https://remote.com/users/bob',
        object: 'https://local.com/users/alice',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onFollow).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://local.com/users/alice',
      'https://remote.com/activities/1',
    );
  });

  it('should process Accept activity with object as string', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Accept',
        actor: 'https://remote.com/users/bob',
        object: 'https://local.com/activities/follow-1',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onAccept).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://local.com/activities/follow-1',
    );
  });

  it('should process Accept activity with object as Follow', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Accept',
        actor: 'https://remote.com/users/bob',
        object: {
          type: 'Follow',
          id: 'https://local.com/activities/follow-1',
          actor: 'https://local.com/users/alice',
          object: 'https://remote.com/users/bob',
        },
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onAccept).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://local.com/activities/follow-1',
    );
  });

  it('should process Reject activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Reject',
        actor: 'https://remote.com/users/bob',
        object: 'https://local.com/activities/follow-1',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onReject).toHaveBeenCalled();
  });

  it('should process Undo activity with inline object', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Undo',
        actor: 'https://remote.com/users/bob',
        object: {
          type: 'Follow',
          id: 'https://remote.com/activities/follow-1',
        },
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onUndo).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'Follow',
      'https://remote.com/activities/follow-1',
    );
  });

  it('should process Create activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Create',
        actor: 'https://remote.com/users/bob',
        object: {
          type: 'Article',
          id: 'https://remote.com/content/test',
          name: 'Test',
          content: '<p>Hello</p>',
        },
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onCreate).toHaveBeenCalled();
  });

  it('should process Update activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Update',
        actor: 'https://remote.com/users/bob',
        object: {
          type: 'Article',
          id: 'https://remote.com/content/test',
          name: 'Updated Test',
        },
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onUpdate).toHaveBeenCalled();
  });

  it('should process Delete activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Delete',
        actor: 'https://remote.com/users/bob',
        object: 'https://remote.com/content/old-post',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onDelete).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://remote.com/content/old-post',
    );
  });

  it('should process Like activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Like',
        actor: 'https://remote.com/users/bob',
        object: 'https://local.com/content/my-post',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onLike).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://local.com/content/my-post',
    );
  });

  it('should process Announce activity', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      {
        type: 'Announce',
        actor: 'https://remote.com/users/bob',
        object: 'https://local.com/content/my-post',
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onAnnounce).toHaveBeenCalledWith(
      'https://remote.com/users/bob',
      'https://local.com/content/my-post',
    );
  });

  it('should process a cpub mirror-request Offer', async () => {
    const cbs = createMockCallbacks();
    cbs.onMirrorRequest = vi.fn();
    const result = await processInboxActivity(
      {
        type: 'Offer',
        id: 'https://remote.com/activities/offer-1',
        actor: 'https://remote.com/actor',
        'cpub:mirrorRequest': true,
        object: {
          type: 'Follow',
          id: 'https://remote.com/activities/follow-1',
          actor: 'https://local.com/actor',
          object: 'https://remote.com/actor',
        },
      },
      cbs,
    );
    expect(result.success).toBe(true);
    expect(cbs.onMirrorRequest).toHaveBeenCalledWith(
      'https://remote.com/actor', // requester
      'https://local.com/actor', // target (us)
      'https://remote.com/activities/offer-1',
    );
  });

  it('should reject an Offer without the cpub marker as unsupported', async () => {
    const cbs = createMockCallbacks();
    cbs.onMirrorRequest = vi.fn();
    const result = await processInboxActivity(
      {
        type: 'Offer',
        id: 'https://remote.com/activities/offer-2',
        actor: 'https://remote.com/actor',
        object: { type: 'Follow', actor: 'https://local.com/actor', object: 'https://remote.com/actor' },
      },
      cbs,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported');
    expect(cbs.onMirrorRequest).not.toHaveBeenCalled();
  });

  it('should reject a mirror-request Offer with no id (correlation key required)', async () => {
    const cbs = createMockCallbacks();
    cbs.onMirrorRequest = vi.fn();
    const result = await processInboxActivity(
      {
        type: 'Offer',
        actor: 'https://remote.com/actor',
        'cpub:mirrorRequest': true,
        object: { type: 'Follow', actor: 'https://local.com/actor', object: 'https://remote.com/actor' },
      },
      cbs,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('id');
    expect(cbs.onMirrorRequest).not.toHaveBeenCalled();
  });

  it('should reject a mirror-request Offer when no handler is wired', async () => {
    const cbs = createMockCallbacks(); // no onMirrorRequest
    const result = await processInboxActivity(
      {
        type: 'Offer',
        id: 'https://remote.com/activities/offer-3',
        actor: 'https://remote.com/actor',
        'cpub:mirrorRequest': true,
        object: { type: 'Follow', actor: 'https://local.com/actor', object: 'https://remote.com/actor' },
      },
      cbs,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('should return error for unsupported activity type', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity(
      { type: 'Move', actor: 'https://remote.com/users/bob', object: 'x' },
      cbs,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported');
  });

  it('should return error for missing type or actor', async () => {
    const cbs = createMockCallbacks();
    const result = await processInboxActivity({}, cbs);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing type or actor');
  });

  describe('actor normalization (attribution-binding hardening)', () => {
    it('normalizes an object-form actor to its string id before dispatch', async () => {
      // Regression: a raw object actor used to reach handlers verbatim, so host-binding
      // guards doing `new URL(actor)` threw and failed OPEN, letting a signed peer squat
      // a third party's object.id. The handler must receive the plain string id.
      const cbs = createMockCallbacks();
      const result = await processInboxActivity(
        {
          type: 'Create',
          actor: { id: 'https://evil.com/actor', type: 'Person' },
          object: { id: 'https://victim.com/u/alice/blog/target', type: 'Article' },
        },
        cbs,
      );
      expect(result.success).toBe(true);
      expect(cbs.onCreate).toHaveBeenCalledWith(
        'https://evil.com/actor',
        expect.objectContaining({ id: 'https://victim.com/u/alice/blog/target' }),
      );
    });

    it('rejects an array-form actor (unbindable to a single signer)', async () => {
      const cbs = createMockCallbacks();
      const result = await processInboxActivity(
        {
          type: 'Create',
          actor: ['https://a.com/actor', 'https://b.com/actor'],
          object: { id: 'https://a.com/note/1', type: 'Note' },
        },
        cbs,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing type or actor');
      expect(cbs.onCreate).not.toHaveBeenCalled();
    });

    it('rejects an object-form actor with a non-string id', async () => {
      const cbs = createMockCallbacks();
      const result = await processInboxActivity(
        { type: 'Like', actor: { id: { nested: true } }, object: 'https://a.com/note/1' },
        cbs,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing type or actor');
      expect(cbs.onLike).not.toHaveBeenCalled();
    });
  });
});
