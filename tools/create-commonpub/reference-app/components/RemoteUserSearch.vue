<script setup lang="ts">
const { searchResult, searchLoading, searchError, searchRemoteUser, followRemoteUser, unfollowRemoteUser } = useFederation();

const query = ref('');

async function onSearch() {
  const q = query.value.trim();
  if (q.length < 3) return;
  await searchRemoteUser(q);
}

async function onFollow(actorUri: string) {
  await followRemoteUser(actorUri);
}

async function onUnfollow(actorUri: string) {
  await unfollowRemoteUser(actorUri);
}
</script>

<template>
  <div class="cpub-remote-search">
    <form class="cpub-remote-search__form" @submit.prevent="onSearch">
      <input
        v-model="query"
        type="text"
        placeholder="@user@instance.example.com"
        class="cpub-remote-search__input"
        aria-label="Search for a remote user by handle"
        :disabled="searchLoading"
      />
      <button
        type="submit"
        class="cpub-remote-search__btn"
        :disabled="searchLoading || query.trim().length < 3"
      >
        {{ searchLoading ? 'Searching...' : 'Search' }}
      </button>
    </form>

    <div v-if="searchError" class="cpub-remote-search__error" role="alert">
      {{ searchError }}
    </div>

    <div v-if="searchResult" class="cpub-remote-search__result">
      <RemoteActorCard
        :actor="searchResult"
        @follow="onFollow"
        @unfollow="onUnfollow"
      />
    </div>

    <div
      v-else-if="!searchLoading && !searchError && query.trim().length >= 3"
      class="cpub-remote-search__empty"
    >
      No results. Make sure you entered a full handle like @user@instance.com
    </div>
  </div>
</template>

<style scoped>
.cpub-remote-search__form {
  display: flex;
  gap: var(--space-2);
}

.cpub-remote-search__input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--border);
  background: var(--surface-1);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
}

.cpub-remote-search__input::placeholder {
  color: var(--text-2);
  opacity: 0.6;
}

.cpub-remote-search__btn {
  padding: var(--space-2) var(--space-4);
  border: 2px solid var(--accent);
  background: var(--accent);
  color: var(--surface-1);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.cpub-remote-search__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-remote-search__error {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--error);
  color: var(--error);
  font-size: var(--font-size-sm);
}

.cpub-remote-search__result {
  margin-top: var(--space-4);
}

.cpub-remote-search__empty {
  margin-top: var(--space-4);
  color: var(--text-2);
  font-size: var(--font-size-sm);
}
</style>
