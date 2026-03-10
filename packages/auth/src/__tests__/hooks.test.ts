import { describe, it, expect, vi } from 'vitest';
import { createAuthHook } from '../hooks';

function createMockAuth(sessionResult: unknown = null) {
  return {
    handler: vi.fn(async () => new Response('auth-handled', { status: 200 })),
    api: {
      getSession: vi.fn().mockResolvedValue(sessionResult),
    },
  } as any;
}

function createMockEvent(pathname: string) {
  return {
    request: new Request(`http://localhost${pathname}`),
    url: new URL(`http://localhost${pathname}`),
    locals: {} as Record<string, unknown>,
  };
}

const mockResolve = vi.fn(async () => new Response('resolved', { status: 200 }));

describe('createAuthHook', () => {
  it('should delegate auth routes to auth handler', async () => {
    const auth = createMockAuth();
    const hook = createAuthHook({ auth });
    const event = createMockEvent('/api/auth/signin');

    const response = await hook({ event, resolve: mockResolve });

    expect(auth.handler).toHaveBeenCalledWith(event.request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('auth-handled');
  });

  it('should not delegate non-auth routes to auth handler', async () => {
    const auth = createMockAuth();
    const hook = createAuthHook({ auth });
    const event = createMockEvent('/dashboard');

    await hook({ event, resolve: mockResolve });

    expect(auth.handler).not.toHaveBeenCalled();
    expect(mockResolve).toHaveBeenCalled();
  });

  it('should set user and session on locals when authenticated', async () => {
    const mockSession = {
      user: { id: 'u1', email: 'test@test.com', role: 'member' },
      session: { id: 's1', userId: 'u1', token: 'tok' },
    };
    const auth = createMockAuth(mockSession);
    const hook = createAuthHook({ auth });
    const event = createMockEvent('/dashboard');

    await hook({ event, resolve: mockResolve });

    expect(event.locals.user).toEqual(mockSession.user);
    expect(event.locals.session).toEqual(mockSession.session);
  });

  it('should set null user and session when not authenticated', async () => {
    const auth = createMockAuth(null);
    const hook = createAuthHook({ auth });
    const event = createMockEvent('/dashboard');

    await hook({ event, resolve: mockResolve });

    expect(event.locals.user).toBeNull();
    expect(event.locals.session).toBeNull();
  });

  it('should handle getSession errors gracefully', async () => {
    const auth = createMockAuth();
    auth.api.getSession.mockRejectedValue(new Error('db error'));
    const hook = createAuthHook({ auth });
    const event = createMockEvent('/dashboard');

    await hook({ event, resolve: mockResolve });

    expect(event.locals.user).toBeNull();
    expect(event.locals.session).toBeNull();
  });

  it('should support custom auth path prefix', async () => {
    const auth = createMockAuth();
    const hook = createAuthHook({ auth, authPathPrefix: '/auth' });
    const event = createMockEvent('/auth/signin');

    await hook({ event, resolve: mockResolve });

    expect(auth.handler).toHaveBeenCalled();
  });
});
