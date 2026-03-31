// Auth plugin — hydrates session state from SSR context.
// On the server, reads from event.context.auth (enriched by middleware).
// On the client, trusts the SSR-hydrated useState values — refreshSession()
// in the layout's onMounted handles lazy revalidation.
import type { ClientAuthUser, ClientAuthSession } from '../composables/useAuth';

export default defineNuxtPlugin(() => {
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
  }

  // Client: useState already hydrated from SSR payload — no fetch needed here.
  // refreshSession() in the default layout's onMounted() handles revalidation.
});
