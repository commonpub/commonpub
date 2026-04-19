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

interface AuthResponse {
  user: ClientAuthUser | null;
  session: ClientAuthSession | null;
}

// `$fetch<T>(url, options)` instantiates Nuxt's NitroFetchRequest generic
// with an excessively deep type graph, which fails TS2589 on this
// specific call shape. The cast below narrows `$fetch` to a concrete
// signature the compiler can check without recursing. Verified session
// 133: removing the cast immediately reintroduces the error. Cleanup is
// upstream — wait for Nuxt to simplify the $fetch type.
async function authPost(url: string, body: Record<string, unknown>): Promise<AuthResponse | null> {
  return ($fetch as (url: string, opts: Record<string, unknown>) => Promise<AuthResponse | null>)(url, {
    method: 'POST',
    body,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function authGet(url: string): Promise<AuthResponse | null> {
  return ($fetch as (url: string, opts: Record<string, unknown>) => Promise<AuthResponse | null>)(url, {
    credentials: 'include',
  });
}

export function useAuth() {
  const user = useState<ClientAuthUser | null>('auth-user', () => null);
  const session = useState<ClientAuthSession | null>('auth-session', () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function signIn(email: string, password: string): Promise<void> {
    const data = await authPost('/api/auth/sign-in/email', { email, password });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signUp(email: string, password: string, username: string): Promise<void> {
    const data = await authPost('/api/auth/sign-up/email', { email, password, username, name: username });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signOut(): Promise<void> {
    await authPost('/api/auth/sign-out', {});
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
      const data = await authGet('/api/me');
      user.value = data?.user ?? null;
      session.value = data?.session ?? null;
    } catch {
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
