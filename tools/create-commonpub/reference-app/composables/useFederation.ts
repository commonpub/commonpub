import type { RemoteActorProfile } from '@commonpub/server';

export function useFederation() {
  const searchResult = ref<RemoteActorProfile | null>(null);
  const searchLoading = ref(false);
  const searchError = ref<string | null>(null);

  async function searchRemoteUser(query: string): Promise<RemoteActorProfile | null> {
    searchLoading.value = true;
    searchError.value = null;
    searchResult.value = null;

    try {
      const result = await $fetch<RemoteActorProfile | null>('/api/federation/search', {
        method: 'POST',
        body: { query },
      });
      searchResult.value = result;
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      searchError.value = msg;
      return null;
    } finally {
      searchLoading.value = false;
    }
  }

  async function followRemoteUser(actorUri: string): Promise<boolean> {
    try {
      await $fetch('/api/federation/follow', {
        method: 'POST',
        body: { actorUri },
      });
      // Update search result to reflect pending follow
      if (searchResult.value && searchResult.value.actorUri === actorUri) {
        searchResult.value = { ...searchResult.value, isFollowPending: true };
      }
      return true;
    } catch {
      return false;
    }
  }

  async function unfollowRemoteUser(actorUri: string): Promise<boolean> {
    try {
      await $fetch('/api/federation/unfollow', {
        method: 'POST',
        body: { actorUri },
      });
      if (searchResult.value && searchResult.value.actorUri === actorUri) {
        searchResult.value = {
          ...searchResult.value,
          isFollowing: false,
          isFollowPending: false,
        };
      }
      return true;
    } catch {
      return false;
    }
  }

  return {
    searchResult,
    searchLoading,
    searchError,
    searchRemoteUser,
    followRemoteUser,
    unfollowRemoteUser,
  };
}
