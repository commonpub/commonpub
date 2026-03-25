// Auth composable — reactive auth state + methods

/** Client-side auth user shape, matching what Better Auth returns */
export interface ClientAuthUser {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export function useAuth() {
  const user = useState<ClientAuthUser | null>('auth-user', () => null);
  const session = useState<ClientAuthSession | null>('auth-session', () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function signIn(email: string, password: string): Promise<void> {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signUp(email: string, password: string, username: string): Promise<void> {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, username, name: username },
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signOut(): Promise<void> {
    await $fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: {} });
    user.value = null;
    session.value = null;
    await navigateTo('/');
  }

  /**
   * Refresh the session from the server.
   * Call on app mount to detect expired sessions and sync SSR-hydrated state.
   */
  async function refreshSession(): Promise<void> {
    if (import.meta.server) return;
    try {
      const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>(
        '/api/me',
        { credentials: 'include' },
      );
      user.value = data?.user ?? null;
      session.value = data?.session ?? null;
    } catch {
      // Session invalid or server unreachable — clear client state
      user.value = null;
      session.value = null;
    }
  }

  return {
    user: readonly(user),
    session: readonly(session),
    isAuthenticated,
    isAdmin,
    signIn,
    signUp,
    signOut,
    refreshSession,
  };
}
