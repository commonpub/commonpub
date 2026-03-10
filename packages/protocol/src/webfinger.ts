import type { WebFingerResponse, ParsedResource } from './types';

export function parseWebFingerResource(resource: string): ParsedResource | null {
  const acctPrefix = 'acct:';
  const input = resource.startsWith(acctPrefix) ? resource.slice(acctPrefix.length) : resource;

  const atIndex = input.indexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === input.length - 1) {
    return null;
  }

  const username = input.slice(0, atIndex);
  const domain = input.slice(atIndex + 1);

  if (!username || !domain || domain.includes('@')) {
    return null;
  }

  return { username, domain };
}

export interface BuildWebFingerOptions {
  username: string;
  domain: string;
  actorUri: string;
  oauthEndpoint?: string;
}

export function buildWebFingerResponse(options: BuildWebFingerOptions): WebFingerResponse {
  const { username, domain, actorUri, oauthEndpoint } = options;

  const links: WebFingerResponse['links'] = [
    {
      rel: 'self',
      type: 'application/activity+json',
      href: actorUri,
    },
    {
      rel: 'http://webfinger.net/rel/profile-page',
      type: 'text/html',
      href: `https://${domain}/@${username}`,
    },
  ];

  if (oauthEndpoint) {
    links.push({
      rel: 'oauth_endpoint',
      href: oauthEndpoint,
    });
  }

  return {
    subject: `acct:${username}@${domain}`,
    links,
  };
}
