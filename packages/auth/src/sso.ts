import type { CommonPubConfig } from '@commonpub/config';

export interface OAuthEndpointDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  domain: string;
}

export interface SSOProviderConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

export function createSSOProviderConfig(config: CommonPubConfig): SSOProviderConfig | null {
  if (!config.features.federation) {
    return null;
  }

  const baseURL = `https://${config.instance.domain}`;

  return {
    issuer: baseURL,
    authorizationEndpoint: `${baseURL}/auth/oauth/authorize`,
    tokenEndpoint: `${baseURL}/api/auth/oauth2/token`,
  };
}

export async function discoverOAuthEndpoint(
  instanceDomain: string,
  username: string,
  fetchFn: typeof fetch = fetch,
): Promise<OAuthEndpointDiscovery | null> {
  const resource = `acct:${username}@${instanceDomain}`;
  const url = `https://${instanceDomain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`;

  try {
    const response = await fetchFn(url, {
      headers: { Accept: 'application/jrd+json' },
    });

    if (!response.ok) {
      return null;
    }

    const jrd = (await response.json()) as {
      links?: Array<{ rel: string; href?: string }>;
    };

    const oauthLink = jrd.links?.find((link) => link.rel === 'oauth_endpoint');
    if (!oauthLink?.href) {
      return null;
    }

    const authorizationEndpoint = oauthLink.href;
    // Token endpoint is always the API path, even though the authorization
    // endpoint points to the consent page (which handles login + consent UI)
    const tokenEndpoint = `https://${instanceDomain}/api/auth/oauth2/token`;

    return {
      authorizationEndpoint,
      tokenEndpoint,
      domain: instanceDomain,
    };
  } catch {
    return null;
  }
}

export function isTrustedInstance(config: CommonPubConfig, domain: string): boolean {
  if (!config.features.federation) return false;
  if (!config.auth.trustedInstances) return false;
  return config.auth.trustedInstances.includes(domain);
}
