import { describe, it, expect } from 'vitest';
import { validateAuthorizeRequest, validateTokenRequest } from '../oauth';
import type { OAuthClient } from '../oauth';

const validClient: OAuthClient = {
  clientId: 'client-1',
  clientSecret: 'secret-1',
  redirectUris: ['https://instance-b.example.com/api/auth/callback/snaplify-sso'],
  instanceDomain: 'instance-b.example.com',
};

describe('validateAuthorizeRequest', () => {
  it('should pass for valid request', () => {
    const result = validateAuthorizeRequest(
      {
        clientId: 'client-1',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
        responseType: 'code',
        scope: 'openid profile',
        state: 'random',
      },
      validClient,
    );
    expect(result).toBeNull();
  });

  it('should reject unknown client', () => {
    const result = validateAuthorizeRequest(
      {
        clientId: 'unknown',
        redirectUri: 'https://evil.com/callback',
        responseType: 'code',
      },
      null,
    );
    expect(result!.error).toBe('invalid_client');
  });

  it('should reject mismatched client_id', () => {
    const result = validateAuthorizeRequest(
      {
        clientId: 'wrong-id',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
        responseType: 'code',
      },
      validClient,
    );
    expect(result!.error).toBe('invalid_client');
  });

  it('should reject non-code response_type', () => {
    const result = validateAuthorizeRequest(
      {
        clientId: 'client-1',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
        responseType: 'token',
      },
      validClient,
    );
    expect(result!.error).toBe('unsupported_response_type');
  });

  it('should reject unregistered redirect_uri', () => {
    const result = validateAuthorizeRequest(
      {
        clientId: 'client-1',
        redirectUri: 'https://evil.com/callback',
        responseType: 'code',
      },
      validClient,
    );
    expect(result!.error).toBe('invalid_redirect_uri');
  });
});

describe('validateTokenRequest', () => {
  it('should pass for valid request', () => {
    const result = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-123',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      validClient,
    );
    expect(result).toBeNull();
  });

  it('should reject unknown client', () => {
    const result = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-123',
        clientId: 'unknown',
        clientSecret: 'secret',
        redirectUri: 'https://evil.com/callback',
      },
      null,
    );
    expect(result!.error).toBe('invalid_client');
  });

  it('should reject wrong client secret', () => {
    const result = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-123',
        clientId: 'client-1',
        clientSecret: 'wrong-secret',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      validClient,
    );
    expect(result!.error).toBe('invalid_client');
  });

  it('should reject non-authorization_code grant_type', () => {
    const result = validateTokenRequest(
      {
        grantType: 'client_credentials',
        code: 'auth-code-123',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      validClient,
    );
    expect(result!.error).toBe('unsupported_grant_type');
  });

  it('should reject missing code', () => {
    const result = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: '',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'https://instance-b.example.com/api/auth/callback/snaplify-sso',
      },
      validClient,
    );
    expect(result!.error).toBe('invalid_request');
  });

  it('should reject unregistered redirect_uri', () => {
    const result = validateTokenRequest(
      {
        grantType: 'authorization_code',
        code: 'auth-code-123',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'https://evil.com/callback',
      },
      validClient,
    );
    expect(result!.error).toBe('invalid_redirect_uri');
  });
});
