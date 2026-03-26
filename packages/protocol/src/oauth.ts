/** Timing-safe string comparison to prevent timing attacks on secrets */
function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  // Pad shorter buffer to prevent length leakage
  if (bufA.length !== bufB.length) {
    // Compare against self to burn constant time, then return false
    const dummy = new Uint8Array(bufA.length);
    let check = 0;
    for (let i = 0; i < bufA.length; i++) {
      check |= bufA[i]! ^ dummy[i]!;
    }
    void check;
    return false;
  }
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!;
  }
  return result === 0;
}

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

  if (!timingSafeCompare(params.clientSecret, client.clientSecret)) {
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

// --- Dynamic Client Registration ---

export interface OAuthDynamicRegistrationRequest {
  clientName: string;
  redirectUris: string[];
  clientUri?: string;
  instanceDomain: string;
}

/**
 * Validate a dynamic OAuth client registration request.
 */
export function validateDynamicRegistration(
  req: OAuthDynamicRegistrationRequest,
): OAuthValidationError | null {
  if (!req.clientName || req.clientName.length > 255) {
    return { error: 'invalid_request', errorDescription: 'client_name is required (max 255 chars)' };
  }

  if (!req.redirectUris || req.redirectUris.length === 0) {
    return { error: 'invalid_request', errorDescription: 'At least one redirect_uri is required' };
  }

  for (const uri of req.redirectUris) {
    try {
      const parsed = new URL(uri);
      if (parsed.hostname !== 'localhost' && parsed.protocol !== 'https:') {
        return { error: 'invalid_request', errorDescription: `Redirect URI must use HTTPS: ${uri}` };
      }
    } catch {
      return { error: 'invalid_request', errorDescription: `Invalid redirect URI: ${uri}` };
    }
  }

  if (!req.instanceDomain || req.instanceDomain.length < 3) {
    return { error: 'invalid_request', errorDescription: 'instance_domain is required' };
  }

  return null;
}
