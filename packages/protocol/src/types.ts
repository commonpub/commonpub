/** WebFinger JRD link */
export interface WebFingerLink {
  rel: string;
  type?: string;
  href?: string;
  template?: string;
}

/** WebFinger JRD response (RFC 7033) */
export interface WebFingerResponse {
  subject: string;
  aliases?: string[];
  links: WebFingerLink[];
}

/** NodeInfo 2.1 software metadata */
export interface NodeInfoSoftware {
  name: string;
  version: string;
  repository?: string;
  homepage?: string;
}

/** NodeInfo 2.1 usage stats */
export interface NodeInfoUsage {
  users: {
    total: number;
    activeMonth: number;
  };
  localPosts: number;
}

/** NodeInfo 2.1 response */
export interface NodeInfoResponse {
  version: '2.1';
  software: NodeInfoSoftware;
  protocols: string[];
  usage: NodeInfoUsage;
  openRegistrations: boolean;
  metadata: Record<string, unknown>;
}

/** Snaplify AP Actor — extends ActivityPub Person */
export interface SnaplifyActor {
  '@context': string[];
  id: string;
  type: 'Person';
  preferredUsername: string;
  name?: string;
  summary?: string;
  url: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  icon?: {
    type: 'Image';
    url: string;
    mediaType?: string;
  };
  publicKey?: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  endpoints?: {
    sharedInbox?: string;
    oauthAuthorizationEndpoint?: string;
    oauthTokenEndpoint?: string;
  };
}

/** Parsed WebFinger resource (acct: URI) */
export interface ParsedResource {
  username: string;
  domain: string;
}
