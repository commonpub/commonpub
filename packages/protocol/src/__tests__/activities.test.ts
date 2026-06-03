import { describe, it, expect } from 'vitest';
import {
  buildCreateActivity,
  buildUpdateActivity,
  buildDeleteActivity,
  buildFollowActivity,
  buildAcceptActivity,
  buildRejectActivity,
  buildUndoActivity,
  buildLikeActivity,
  buildAnnounceActivity,
  buildMirrorRequestActivity,
} from '../activities';
import { AP_CONTEXT, AP_PUBLIC, CPUB_MIRROR_REQUEST, type APArticle, type APNote } from '../activityTypes';

const domain = 'test.example.com';
const actorUri = 'https://test.example.com/users/alice';

function createTestArticle(): APArticle {
  return {
    '@context': AP_CONTEXT,
    type: 'Article',
    id: 'https://test.example.com/content/my-post',
    attributedTo: actorUri,
    name: 'My Post',
    content: '<p>Hello world</p>',
    to: [AP_PUBLIC],
    cc: [`${actorUri}/followers`],
  };
}

function createTestNote(): APNote {
  return {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: 'https://test.example.com/comments/123',
    attributedTo: actorUri,
    content: 'Nice article!',
    inReplyTo: 'https://test.example.com/content/my-post',
    to: [AP_PUBLIC],
    cc: [`${actorUri}/followers`],
  };
}

describe('buildCreateActivity', () => {
  it('should build a Create activity wrapping an Article', () => {
    const article = createTestArticle();
    const activity = buildCreateActivity(domain, actorUri, article);

    expect(activity.type).toBe('Create');
    expect(activity['@context']).toBe(AP_CONTEXT);
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(article);
    expect(activity.to).toEqual([AP_PUBLIC]);
    expect(activity.cc).toEqual([`${actorUri}/followers`]);
    expect(activity.id).toMatch(/^https:\/\/test\.example\.com\/activities\//);
    expect(activity.published).toBeDefined();
  });

  it('should build a Create activity wrapping a Note', () => {
    const note = createTestNote();
    const activity = buildCreateActivity(domain, actorUri, note);

    expect(activity.type).toBe('Create');
    expect(activity.object.type).toBe('Note');
  });
});

describe('buildUpdateActivity', () => {
  it('should build an Update activity', () => {
    const article = createTestArticle();
    const activity = buildUpdateActivity(domain, actorUri, article);

    expect(activity.type).toBe('Update');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(article);
    expect(activity.to).toEqual([AP_PUBLIC]);
  });
});

describe('buildDeleteActivity', () => {
  it('should build a Delete activity with Tombstone', () => {
    const activity = buildDeleteActivity(
      domain,
      actorUri,
      'https://test.example.com/content/old-post',
      'Article',
    );

    expect(activity.type).toBe('Delete');
    expect(activity.actor).toBe(actorUri);
    expect(typeof activity.object).toBe('object');
    if (typeof activity.object === 'object') {
      expect(activity.object.type).toBe('Tombstone');
      expect(activity.object.formerType).toBe('Article');
    }
    expect(activity.to).toEqual([AP_PUBLIC]);
  });
});

describe('buildFollowActivity', () => {
  it('should build a Follow activity', () => {
    const targetUri = 'https://remote.example.com/users/bob';
    const activity = buildFollowActivity(domain, actorUri, targetUri);

    expect(activity.type).toBe('Follow');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(targetUri);
    expect(activity.id).toMatch(/^https:\/\/test\.example\.com\/activities\//);
  });
});

describe('buildAcceptActivity', () => {
  it('should build an Accept activity wrapping a Follow', () => {
    const follow = buildFollowActivity(domain, actorUri, 'https://remote.com/users/bob');
    const activity = buildAcceptActivity('remote.com', 'https://remote.com/users/bob', follow);

    expect(activity.type).toBe('Accept');
    expect(activity.actor).toBe('https://remote.com/users/bob');
    expect(activity.object).toBe(follow);
  });

  it('should accept a string reference as object', () => {
    const activity = buildAcceptActivity(domain, actorUri, 'https://remote.com/activities/1');

    expect(activity.type).toBe('Accept');
    expect(activity.object).toBe('https://remote.com/activities/1');
  });
});

describe('buildRejectActivity', () => {
  it('should build a Reject activity', () => {
    const activity = buildRejectActivity(domain, actorUri, 'https://remote.com/activities/1');

    expect(activity.type).toBe('Reject');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe('https://remote.com/activities/1');
  });
});

describe('buildUndoActivity', () => {
  it('should build an Undo wrapping a Follow', () => {
    const follow = buildFollowActivity(domain, actorUri, 'https://remote.com/users/bob');
    const activity = buildUndoActivity(domain, actorUri, follow);

    expect(activity.type).toBe('Undo');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(follow);
  });

  it('should build an Undo wrapping a Like', () => {
    const like = buildLikeActivity(domain, actorUri, 'https://remote.com/content/post');
    const activity = buildUndoActivity(domain, actorUri, like);

    expect(activity.type).toBe('Undo');
    expect(typeof activity.object).toBe('object');
  });
});

describe('buildLikeActivity', () => {
  it('should build a Like activity', () => {
    const objectUri = 'https://remote.example.com/content/great-post';
    const activity = buildLikeActivity(domain, actorUri, objectUri);

    expect(activity.type).toBe('Like');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(objectUri);
  });
});

describe('buildAnnounceActivity', () => {
  it('should build an Announce activity', () => {
    const objectUri = 'https://remote.example.com/content/shared-post';
    const followersUri = `${actorUri}/followers`;
    const activity = buildAnnounceActivity(domain, actorUri, objectUri, followersUri);

    expect(activity.type).toBe('Announce');
    expect(activity.actor).toBe(actorUri);
    expect(activity.object).toBe(objectUri);
    expect(activity.to).toEqual([AP_PUBLIC]);
    expect(activity.cc).toEqual([followersUri]);
  });
});

describe('buildMirrorRequestActivity', () => {
  it('should build an Offer(Follow) with the cpub mirror-request marker', () => {
    const requester = 'https://us.example.com/actor';
    const target = 'https://them.example.com/actor';
    const activity = buildMirrorRequestActivity('us.example.com', requester, target);

    expect(activity.type).toBe('Offer');
    expect(activity.actor).toBe(requester);
    expect(activity[CPUB_MIRROR_REQUEST]).toBe(true);
    // Inner Follow: target follows requester ("please mirror me").
    expect(activity.object.type).toBe('Follow');
    expect(activity.object.actor).toBe(target);
    expect(activity.object.object).toBe(requester);
    expect(activity.id).toContain('https://us.example.com/activities/');
  });
});
