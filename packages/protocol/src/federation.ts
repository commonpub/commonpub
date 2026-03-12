import type { CommonPubConfig } from '@commonpub/config';
import { parseWebFingerResource, buildWebFingerResponse } from './webfinger.js';
import { buildNodeInfoResponse, buildNodeInfoWellKnown } from './nodeinfo.js';
import type { WebFingerResponse, NodeInfoResponse } from './types.js';

export interface FederationHandlers {
  handleWebFinger: (resource: string) => Promise<WebFingerResponse | null>;
  handleNodeInfo: () => Promise<NodeInfoResponse>;
  handleNodeInfoWellKnown: () => { links: Array<{ rel: string; href: string }> };
}

export interface CreateFederationOptions {
  config: CommonPubConfig;
  version: string;
  lookupUser: (
    username: string,
  ) => Promise<{ id: string; username: string; actorUri: string } | null>;
  getStats: () => Promise<{ userCount: number; activeMonthCount: number; localPostCount: number }>;
}

export function createFederation(options: CreateFederationOptions): FederationHandlers | null {
  const { config, version, lookupUser, getStats } = options;

  if (!config.features.federation) {
    return null;
  }

  const domain = config.instance.domain;

  const oauthEndpoint = `https://${domain}/api/auth/oauth2/authorize`;

  return {
    async handleWebFinger(resource: string): Promise<WebFingerResponse | null> {
      const parsed = parseWebFingerResource(resource);
      if (!parsed) return null;

      if (parsed.domain !== domain) return null;

      const user = await lookupUser(parsed.username);
      if (!user) return null;

      return buildWebFingerResponse({
        username: user.username,
        domain,
        actorUri: user.actorUri,
        oauthEndpoint,
      });
    },

    async handleNodeInfo(): Promise<NodeInfoResponse> {
      const stats = await getStats();
      return buildNodeInfoResponse({
        config,
        version,
        ...stats,
      });
    },

    handleNodeInfoWellKnown() {
      return buildNodeInfoWellKnown(domain);
    },
  };
}
