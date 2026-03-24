// Auth plugin — fetches session on app init
import type { ClientAuthUser, ClientAuthSession } from '~/composables/useAuth';

export default defineNuxtPlugin(async () => {
  const user = useState<ClientAuthUser | null>('auth-user', () => null);
  const session = useState<ClientAuthSession | null>('auth-session', () => null);

  if (import.meta.server) {
    const event = useRequestEvent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authCtx = (event?.context as any)?.auth as { user?: ClientAuthUser; session?: ClientAuthSession } | undefined;
    if (authCtx) {
      user.value = (authCtx.user as ClientAuthUser) ?? null;
      session.value = (authCtx.session as ClientAuthSession) ?? null;
    }
    return;
  }

  // On client, fetch session from the auth API
  try {
    const data = await $fetch<{ user: ClientAuthUser | null; session: ClientAuthSession | null }>('/api/auth/get-session', {
      credentials: 'include',
    });
    user.value = data?.user ?? null;
    session.value = data?.session ?? null;
  } catch {
    user.value = null;
    session.value = null;
  }
});
