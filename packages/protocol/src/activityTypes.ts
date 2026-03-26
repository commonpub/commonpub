/** ActivityPub JSON-LD context */
export const AP_CONTEXT = 'https://www.w3.org/ns/activitystreams';
export const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

// --- AP Object Types ---

export interface APArticle {
  '@context': string | string[];
  type: 'Article';
  id: string;
  attributedTo: string;
  name: string;
  content: string;
  summary?: string;
  published?: string;
  updated?: string;
  url?: string;
  to: string[];
  cc?: string[];
  attachment?: APAttachment[];
  tag?: APTag[];
}

export interface APNote {
  '@context': string | string[];
  type: 'Note';
  id: string;
  attributedTo: string;
  content: string;
  inReplyTo?: string;
  published?: string;
  to: string[];
  cc?: string[];
}

export interface APTombstone {
  '@context': string | string[];
  type: 'Tombstone';
  id: string;
  formerType: string;
}

export interface APAttachment {
  type: string;
  url: string;
  mediaType?: string;
  name?: string;
}

export interface APTag {
  type: 'Hashtag' | 'Mention';
  href?: string;
  name: string;
}

/** FEP-1b12 Group actor for hub/community federation */
export interface APGroup {
  '@context': string | string[];
  type: 'Group';
  id: string;
  preferredUsername: string;
  name: string;
  summary?: string;
  inbox: string;
  outbox: string;
  followers: string;
  url?: string;
  icon?: { type: string; url: string };
  image?: { type: string; url: string };
  publicKey?: { id: string; owner: string; publicKeyPem: string };
  /** FEP-1b12: lists hub admins/owners */
  attributedTo?: string[];
}

export type APObject = APArticle | APNote | APTombstone;

// --- AP Activity Types ---

export interface APCreate {
  '@context': string | string[];
  type: 'Create';
  id: string;
  actor: string;
  object: APArticle | APNote;
  to: string[];
  cc?: string[];
  published?: string;
}

export interface APUpdate {
  '@context': string | string[];
  type: 'Update';
  id: string;
  actor: string;
  object: APArticle | APNote;
  to: string[];
  cc?: string[];
}

export interface APDelete {
  '@context': string | string[];
  type: 'Delete';
  id: string;
  actor: string;
  object: APTombstone | string;
  to: string[];
}

export interface APFollow {
  '@context': string | string[];
  type: 'Follow';
  id: string;
  actor: string;
  object: string;
}

export interface APAccept {
  '@context': string | string[];
  type: 'Accept';
  id: string;
  actor: string;
  object: APFollow | string;
}

export interface APReject {
  '@context': string | string[];
  type: 'Reject';
  id: string;
  actor: string;
  object: APFollow | string;
}

export interface APUndo {
  '@context': string | string[];
  type: 'Undo';
  id: string;
  actor: string;
  object: APFollow | APLike | string;
}

export interface APLike {
  '@context': string | string[];
  type: 'Like';
  id: string;
  actor: string;
  object: string;
}

export interface APAnnounce {
  '@context': string | string[];
  type: 'Announce';
  id: string;
  actor: string;
  object: string;
  to: string[];
  cc?: string[];
}

export type APActivity =
  | APCreate
  | APUpdate
  | APDelete
  | APFollow
  | APAccept
  | APReject
  | APUndo
  | APLike
  | APAnnounce;

// --- AP Collections ---

export interface APOrderedCollection {
  '@context': string;
  type: 'OrderedCollection';
  id: string;
  totalItems: number;
  first?: string;
  last?: string;
}

export interface APOrderedCollectionPage {
  '@context': string;
  type: 'OrderedCollectionPage';
  id: string;
  partOf: string;
  orderedItems: APActivity[];
  next?: string;
  prev?: string;
}
