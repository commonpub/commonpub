import {
  AP_CONTEXT,
  AP_PUBLIC,
  type APCreate,
  type APUpdate,
  type APDelete,
  type APFollow,
  type APAccept,
  type APReject,
  type APUndo,
  type APLike,
  type APAnnounce,
  type APArticle,
  type APNote,
  type APTombstone,
} from './activityTypes.js';

function activityId(domain: string): string {
  return `https://${domain}/activities/${crypto.randomUUID()}`;
}

export function buildCreateActivity(
  domain: string,
  actorUri: string,
  object: APArticle | APNote,
): APCreate {
  return {
    '@context': AP_CONTEXT,
    type: 'Create',
    id: activityId(domain),
    actor: actorUri,
    object,
    to: object.to,
    cc: object.cc,
    published: new Date().toISOString(),
  };
}

export function buildUpdateActivity(
  domain: string,
  actorUri: string,
  object: APArticle | APNote,
): APUpdate {
  return {
    '@context': AP_CONTEXT,
    type: 'Update',
    id: activityId(domain),
    actor: actorUri,
    object,
    to: object.to,
    cc: object.cc,
  };
}

export function buildDeleteActivity(
  domain: string,
  actorUri: string,
  objectId: string,
  formerType: string,
): APDelete {
  const tombstone: APTombstone = {
    '@context': AP_CONTEXT,
    type: 'Tombstone',
    id: objectId,
    formerType,
  };
  return {
    '@context': AP_CONTEXT,
    type: 'Delete',
    id: activityId(domain),
    actor: actorUri,
    object: tombstone,
    to: [AP_PUBLIC],
  };
}

export function buildFollowActivity(
  domain: string,
  actorUri: string,
  targetActorUri: string,
): APFollow {
  return {
    '@context': AP_CONTEXT,
    type: 'Follow',
    id: activityId(domain),
    actor: actorUri,
    object: targetActorUri,
  };
}

export function buildAcceptActivity(
  domain: string,
  actorUri: string,
  followActivity: APFollow | string,
): APAccept {
  return {
    '@context': AP_CONTEXT,
    type: 'Accept',
    id: activityId(domain),
    actor: actorUri,
    object: followActivity,
  };
}

export function buildRejectActivity(
  domain: string,
  actorUri: string,
  followActivity: APFollow | string,
): APReject {
  return {
    '@context': AP_CONTEXT,
    type: 'Reject',
    id: activityId(domain),
    actor: actorUri,
    object: followActivity,
  };
}

export function buildUndoActivity(
  domain: string,
  actorUri: string,
  originalActivity: APFollow | APLike | string,
): APUndo {
  return {
    '@context': AP_CONTEXT,
    type: 'Undo',
    id: activityId(domain),
    actor: actorUri,
    object: originalActivity,
  };
}

export function buildLikeActivity(domain: string, actorUri: string, objectUri: string): APLike {
  return {
    '@context': AP_CONTEXT,
    type: 'Like',
    id: activityId(domain),
    actor: actorUri,
    object: objectUri,
  };
}

export function buildAnnounceActivity(
  domain: string,
  actorUri: string,
  objectUri: string,
  followersUri: string,
): APAnnounce {
  return {
    '@context': AP_CONTEXT,
    type: 'Announce',
    id: activityId(domain),
    actor: actorUri,
    object: objectUri,
    to: [AP_PUBLIC],
    cc: [followersUri],
  };
}
