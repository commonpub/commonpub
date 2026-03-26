// Types
export type {
  WebFingerResponse,
  WebFingerLink,
  NodeInfoResponse,
  NodeInfoSoftware,
  NodeInfoUsage,
  CommonPubActor,
  ParsedResource,
} from './types.js';

// WebFinger
export { parseWebFingerResource, buildWebFingerResponse } from './webfinger.js';
export type { BuildWebFingerOptions } from './webfinger.js';

// NodeInfo
export { buildNodeInfoResponse, buildNodeInfoWellKnown } from './nodeinfo.js';
export type { BuildNodeInfoOptions } from './nodeinfo.js';

// Federation
export { createFederation } from './federation.js';
export type { FederationHandlers, CreateFederationOptions } from './federation.js';

// OAuth
export { validateAuthorizeRequest, validateTokenRequest, validateDynamicRegistration } from './oauth.js';
export type {
  OAuthAuthorizeRequest,
  OAuthTokenRequest,
  OAuthClient,
  OAuthValidationError,
  OAuthDynamicRegistrationRequest,
} from './oauth.js';

// Activity Types
export { AP_CONTEXT, AP_PUBLIC } from './activityTypes.js';
export type {
  APArticle,
  APNote,
  APTombstone,
  APGroup,
  APObject,
  APCreate,
  APUpdate,
  APDelete,
  APFollow,
  APAccept,
  APReject,
  APUndo,
  APLike,
  APAnnounce,
  APActivity,
  APAttachment,
  APTag,
  APOrderedCollection,
  APOrderedCollectionPage,
} from './activityTypes.js';

// Activity Builders
export {
  buildCreateActivity,
  buildUpdateActivity,
  buildDeleteActivity,
  buildFollowActivity,
  buildAcceptActivity,
  buildRejectActivity,
  buildUndoActivity,
  buildLikeActivity,
  buildAnnounceActivity,
} from './activities.js';

// Content Mapper
export { contentToArticle, contentToNote, articleToContent, noteToComment } from './contentMapper.js';
export type { ContentItemInput, AuthorInput, CommentInput } from './contentMapper.js';

// Actor Resolution
export {
  validateActorResponse,
  extractInbox,
  extractSharedInbox,
  resolveActor,
  resolveActorViaWebFinger,
} from './actorResolver.js';
export type { ResolvedActor, FetchFn } from './actorResolver.js';

// Keypair Management
export { generateKeypair, exportPublicKeyPem, exportPrivateKeyPem, buildKeyId, verifyHttpSignature } from './keypairs.js';
export type { ActorKeypair } from './keypairs.js';

// Inbox Processing
export { processInboxActivity } from './inbox.js';
export type { InboxCallbacks, InboxResult } from './inbox.js';

// Outbox Generation
export { generateOutboxCollection, generateOutboxPage } from './outbox.js';

// HTTP Signature Signing (outbound)
export { signRequest } from './sign.js';

// HTML Sanitization
export { sanitizeHtml } from './sanitize.js';
