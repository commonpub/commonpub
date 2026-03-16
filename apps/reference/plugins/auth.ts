// Auth plugin — fetches session on app init
export default defineNuxtPlugin(async () => {
  const user = useState<Record<string, unknown> | null>('auth-user', () => null);
  const session = useState<Record<string, unknown> | null>('auth-session', () => null);

  if (import.meta.server) {
    const event = useRequestEvent();
    if (event?.context?.auth) {
      user.value = event.context.auth.user ?? null;
      session.value = event.context.auth.session ?? null;
    }
    return;
  }

  // On client, fetch session from the auth API
  try {
    const data = await $fetch<{ user: Record<string, unknown> | null; session: Record<string, unknown> | null }>('/api/auth/get-session', {
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  } catch {
    user.value = null;
    session.value = null;
  }
});
