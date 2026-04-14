import { describe, it, expect } from 'vitest';
import { activityDirectionEnum, activityStatusEnum, followRelationshipStatusEnum } from '../enums';
import {
  createRemoteActorSchema,
  createActivitySchema,
  createFollowRelationshipSchema,
  actorUriSchema,
  activityDirectionSchema,
  activityStatusSchema,
  followRelationshipStatusSchema,
} from '../validators';

describe('federation enums', () => {
  it('activityDirectionEnum has inbound and outbound', () => {
    expect(activityDirectionEnum.enumValues).toEqual(['inbound', 'outbound']);
  });

  it('activityStatusEnum has all statuses', () => {
    expect(activityStatusEnum.enumValues).toEqual(['pending', 'delivered', 'failed', 'processed']);
  });

  it('followRelationshipStatusEnum has all statuses', () => {
    expect(followRelationshipStatusEnum.enumValues).toEqual(['pending', 'accepted', 'rejected']);
  });
});

describe('actorUriSchema', () => {
  it('accepts valid HTTPS actor URIs', () => {
    expect(actorUriSchema.safeParse('https://example.com/users/alice').success).toBe(true);
    expect(actorUriSchema.safeParse('https://mastodon.social/@alice').success).toBe(true);
  });

  it('accepts HTTP URIs (for dev/local instances)', () => {
    expect(actorUriSchema.safeParse('http://localhost:3000/users/alice').success).toBe(true);
  });

  it('rejects non-URL strings', () => {
    expect(actorUriSchema.safeParse('not-a-url').success).toBe(false);
    expect(actorUriSchema.safeParse('').success).toBe(false);
  });

  it('rejects URIs over 2048 chars', () => {
    expect(actorUriSchema.safeParse('https://example.com/' + 'a'.repeat(2040)).success).toBe(false);
  });
});

describe('activityDirectionSchema', () => {
  it('accepts inbound and outbound', () => {
    expect(activityDirectionSchema.safeParse('inbound').success).toBe(true);
    expect(activityDirectionSchema.safeParse('outbound').success).toBe(true);
  });

  it('rejects invalid directions', () => {
    expect(activityDirectionSchema.safeParse('sideways').success).toBe(false);
    expect(activityDirectionSchema.safeParse('').success).toBe(false);
  });
});

describe('activityStatusSchema', () => {
  it.each(['pending', 'delivered', 'failed', 'processed'] as const)(
    'accepts status: %s',
    (status) => {
      expect(activityStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it('rejects invalid statuses', () => {
    expect(activityStatusSchema.safeParse('unknown').success).toBe(false);
    expect(activityStatusSchema.safeParse('queued').success).toBe(false);
  });
});

describe('followRelationshipStatusSchema', () => {
  it.each(['pending', 'accepted', 'rejected'] as const)(
    'accepts status: %s',
    (status) => {
      expect(followRelationshipStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it('rejects invalid statuses', () => {
    expect(followRelationshipStatusSchema.safeParse('blocked').success).toBe(false);
  });
});

describe('createRemoteActorSchema', () => {
  const validActor = {
    actorUri: 'https://remote.example.com/users/bob',
    inbox: 'https://remote.example.com/users/bob/inbox',
    instanceDomain: 'remote.example.com',
  };

  it('accepts valid remote actor', () => {
    const result = createRemoteActorSchema.safeParse(validActor);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actorUri).toBe(validActor.actorUri);
      expect(result.data.inbox).toBe(validActor.inbox);
      expect(result.data.instanceDomain).toBe(validActor.instanceDomain);
    }
  });

  it('accepts actor with optional outbox', () => {
    const result = createRemoteActorSchema.safeParse({
      ...validActor,
      outbox: 'https://remote.example.com/users/bob/outbox',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid actor URI', () => {
    expect(createRemoteActorSchema.safeParse({
      ...validActor,
      actorUri: 'not-a-url',
    }).success).toBe(false);
  });

  it('rejects invalid inbox URL', () => {
    expect(createRemoteActorSchema.safeParse({
      ...validActor,
      inbox: 'not-a-url',
    }).success).toBe(false);
  });

  it('rejects empty instance domain', () => {
    expect(createRemoteActorSchema.safeParse({
      ...validActor,
      instanceDomain: '',
    }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(createRemoteActorSchema.safeParse({}).success).toBe(false);
    expect(createRemoteActorSchema.safeParse({ actorUri: validActor.actorUri }).success).toBe(false);
  });
});

describe('createActivitySchema', () => {
  const validActivity = {
    type: 'Create',
    actorUri: 'https://example.com/users/alice',
    payload: { '@context': 'https://www.w3.org/ns/activitystreams' },
    direction: 'outbound',
  };

  it('accepts valid activity', () => {
    const result = createActivitySchema.safeParse(validActivity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('Create');
      expect(result.data.direction).toBe('outbound');
    }
  });

  it('accepts all activity types (Follow, Like, Undo, etc.)', () => {
    for (const type of ['Follow', 'Like', 'Undo', 'Delete', 'Announce', 'Accept']) {
      expect(createActivitySchema.safeParse({ ...validActivity, type }).success).toBe(true);
    }
  });

  it('rejects empty type', () => {
    expect(createActivitySchema.safeParse({ ...validActivity, type: '' }).success).toBe(false);
  });

  it('rejects invalid direction', () => {
    expect(createActivitySchema.safeParse({
      ...validActivity,
      direction: 'invalid',
    }).success).toBe(false);
  });

  it('rejects invalid actor URI', () => {
    expect(createActivitySchema.safeParse({
      ...validActivity,
      actorUri: 'not-url',
    }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(createActivitySchema.safeParse({}).success).toBe(false);
  });
});

describe('createFollowRelationshipSchema', () => {
  it('accepts valid follow relationship', () => {
    const result = createFollowRelationshipSchema.safeParse({
      followerActorUri: 'https://a.example.com/users/alice',
      followingActorUri: 'https://b.example.com/users/bob',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.followerActorUri).toContain('alice');
      expect(result.data.followingActorUri).toContain('bob');
    }
  });

  it('rejects invalid follower URI', () => {
    expect(createFollowRelationshipSchema.safeParse({
      followerActorUri: 'not-url',
      followingActorUri: 'https://b.example.com/users/bob',
    }).success).toBe(false);
  });

  it('rejects invalid following URI', () => {
    expect(createFollowRelationshipSchema.safeParse({
      followerActorUri: 'https://a.example.com/users/alice',
      followingActorUri: 'not-url',
    }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(createFollowRelationshipSchema.safeParse({}).success).toBe(false);
  });
});
