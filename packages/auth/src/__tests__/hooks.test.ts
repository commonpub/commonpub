/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware } from '../hooks';

function createMockAuth(sessionResult: unknown = null) {
  return {
    handler: vi.fn(async () => new Response('auth-handled', { status: 200 })),
    api: {
      getSession: vi.fn().mockResolvedValue(sessionResult),
    },
  } as any;
}

describe('createAuthMiddleware', () => {
  describe('handleAuthRoute', () => {
    it('should delegate auth routes to auth handler', async () => {
      const auth = createMockAuth();
      const middleware = createAuthMiddleware({ auth });
      const request = new Request('http://localhost/api/auth/signin');

      const response = await middleware.handleAuthRoute(request, '/api/auth/signin');

      expect(auth.handler).toHaveBeenCalledWith(request);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(await response!.text()).toBe('auth-handled');
    });

    it('should return null for non-auth routes', async () => {
      const auth = createMockAuth();
      const middleware = createAuthMiddleware({ auth });
      const request = new Request('http://localhost/dashboard');

      const response = await middleware.handleAuthRoute(request, '/dashboard');

      expect(response).toBeNull();
      expect(auth.handler).not.toHaveBeenCalled();
    });

    it('should support custom auth path prefix', async () => {
      const auth = createMockAuth();
      const middleware = createAuthMiddleware({ auth, authPathPrefix: '/auth' });
      const request = new Request('http://localhost/auth/signin');

      const response = await middleware.handleAuthRoute(request, '/auth/signin');

      expect(auth.handler).toHaveBeenCalled();
      expect(response).not.toBeNull();
    });
  });

  describe('resolveSession', () => {
    it('should return user and session when authenticated', async () => {
      const mockSession = {
        user: { id: 'u1', email: 'test@test.com', role: 'member' },
        session: { id: 's1', userId: 'u1', token: 'tok' },
      };
      const auth = createMockAuth(mockSession);
      const middleware = createAuthMiddleware({ auth });

      const result = await middleware.resolveSession(new Headers());

      expect(result.user).toEqual(mockSession.user);
      expect(result.session).toEqual(mockSession.session);
    });

    it('should return null user and session when not authenticated', async () => {
      const auth = createMockAuth(null);
      const middleware = createAuthMiddleware({ auth });

      const result = await middleware.resolveSession(new Headers());

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });

    it('should handle getSession errors gracefully', async () => {
      const auth = createMockAuth();
      auth.api.getSession.mockRejectedValue(new Error('db error'));
      const middleware = createAuthMiddleware({ auth });

      const result = await middleware.resolveSession(new Headers());

      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });
  });
});
