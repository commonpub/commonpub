import { hasScope } from '@commonpub/server';
import type { PublicApiScope } from '@commonpub/schema';
import type { H3Event } from 'h3';

/**
 * Enforce a single scope on a public-API endpoint. Throws 403 if the key
 * doesn't hold it (or the wildcard). Throws 401 if the event isn't an
 * API-key request at all — that shouldn't happen because the middleware
 * runs first, but defending against misconfiguration is cheap.
 */
export function requireApiScope(event: H3Event, needed: PublicApiScope): void {
  const scopes = event.context.apiScopes;
  if (!scopes) {
    throw createError({ statusCode: 401, statusMessage: 'Missing API key' });
  }
  if (!hasScope(scopes, needed)) {
    throw createError({ statusCode: 403, statusMessage: `Missing scope: ${needed}` });
  }
}
