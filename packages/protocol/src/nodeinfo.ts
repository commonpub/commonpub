import type { NodeInfoResponse } from './types.js';
import type { CommonPubConfig } from '@commonpub/config';

export interface BuildNodeInfoOptions {
  config: CommonPubConfig;
  version: string;
  userCount: number;
  activeMonthCount: number;
  localPostCount: number;
}

export function buildNodeInfoResponse(options: BuildNodeInfoOptions): NodeInfoResponse {
  const { config, version, userCount, activeMonthCount, localPostCount } = options;

  const protocols: string[] = [];
  if (config.features.federation) {
    protocols.push('activitypub');
  }

  return {
    version: '2.1',
    software: {
      name: 'commonpub',
      version,
      repository: 'https://github.com/commonpub/commonpub',
      homepage: `https://${config.instance.domain}`,
    },
    protocols,
    usage: {
      users: {
        total: userCount,
        activeMonth: activeMonthCount,
      },
      localPosts: localPostCount,
    },
    openRegistrations: config.auth.emailPassword,
    metadata: {
      nodeName: config.instance.name,
      nodeDescription: config.instance.description,
      features: {
        communities: config.features.communities,
        docs: config.features.docs,
        video: config.features.video,
        contests: config.features.contests,
        learning: config.features.learning,
        explainers: config.features.explainers,
      },
    },
  };
}

export function buildNodeInfoWellKnown(domain: string): {
  links: Array<{ rel: string; href: string }>;
} {
  return {
    links: [
      {
        rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
        href: `https://${domain}/nodeinfo/2.1`,
      },
    ],
  };
}
