// Auth composable — reactive auth state + methods
export function useAuth() {
  const user = useState<Record<string, unknown> | null>('auth-user', () => null);
  const session = useState<Record<string, unknown> | null>('auth-session', () => null);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => (user.value?.role as string) === 'admin');

  async function signIn(email: string, password: string): Promise<void> {
    const data = await $fetch<{ user: Record<string, unknown>; session: Record<string, unknown> }>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signUp(email: string, password: string, username: string): Promise<void> {
    const data = await $fetch<{ user: Record<string, unknown>; session: Record<string, unknown> }>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email, password, name: username },
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  }

  async function signOut(): Promise<void> {
    await $fetch('/api/auth/sign-out', { method: 'POST' });
    user.value = null;
    session.value = null;
    await navigateTo('/');
  }

  return {
    user: readonly(user),
    session: readonly(session),
    isAuthenticated,
    isAdmin,
    signIn,
    signUp,
    signOut,
  };
}
