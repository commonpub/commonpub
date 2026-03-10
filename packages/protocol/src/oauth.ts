export interface OAuthAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope?: string;
  state?: string;
}

export interface OAuthTokenRequest {
  grantType: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  instanceDomain: string;
}

export interface OAuthValidationError {
  error: string;
  errorDescription: string;
}

export function validateAuthorizeRequest(
  params: OAuthAuthorizeRequest,
  client: OAuthClient | null,
): OAuthValidationError | null {
  if (!client) {
    return { error: 'invalid_client', errorDescription: 'Unknown client_id' };
  }

  if (params.clientId !== client.clientId) {
    return { error: 'invalid_client', errorDescription: 'Client ID mismatch' };
  }

  if (params.responseType !== 'code') {
    return {
      error: 'unsupported_response_type',
      errorDescription: 'Only "code" response_type is supported',
    };
  }

  if (!client.redirectUris.includes(params.redirectUri)) {
    return { error: 'invalid_redirect_uri', errorDescription: 'Redirect URI not registered' };
  }

  return null;
}

export function validateTokenRequest(
  params: OAuthTokenRequest,
  client: OAuthClient | null,
): OAuthValidationError | null {
  if (!client) {
    return { error: 'invalid_client', errorDescription: 'Unknown client_id' };
  }

  if (params.clientId !== client.clientId) {
    return { error: 'invalid_client', errorDescription: 'Client ID mismatch' };
  }

  if (params.clientSecret !== client.clientSecret) {
    return { error: 'invalid_client', errorDescription: 'Invalid client secret' };
  }

  if (params.grantType !== 'authorization_code') {
    return {
      error: 'unsupported_grant_type',
      errorDescription: 'Only "authorization_code" grant_type is supported',
    };
  }

  if (!client.redirectUris.includes(params.redirectUri)) {
    return { error: 'invalid_redirect_uri', errorDescription: 'Redirect URI not registered' };
  }

  if (!params.code) {
    return { error: 'invalid_request', errorDescription: 'Authorization code is required' };
  }

  return null;
}
