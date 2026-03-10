// Types
export type {
  WebFingerResponse,
  WebFingerLink,
  NodeInfoResponse,
  NodeInfoSoftware,
  NodeInfoUsage,
  SnaplifyActor,
  ParsedResource,
} from './types';

// WebFinger
export { parseWebFingerResource, buildWebFingerResponse } from './webfinger';
export type { BuildWebFingerOptions } from './webfinger';

// NodeInfo
export { buildNodeInfoResponse, buildNodeInfoWellKnown } from './nodeinfo';
export type { BuildNodeInfoOptions } from './nodeinfo';

// Federation
export { createFederation } from './federation';
export type { FederationHandlers, CreateFederationOptions } from './federation';

// OAuth
export { validateAuthorizeRequest, validateTokenRequest } from './oauth';
export type {
  OAuthAuthorizeRequest,
  OAuthTokenRequest,
  OAuthClient,
  OAuthValidationError,
} from './oauth';
