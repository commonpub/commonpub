<script setup lang="ts">
import type { RemoteActorProfile, FederatedContentItem } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const handle = computed(() => decodeURIComponent(route.params.handle as string));

const { searchResult, searchLoading, searchError, searchRemoteUser, followRemoteUser, unfollowRemoteUser } = useFederation();

const content = ref<FederatedContentItem[]>([]);
const contentLoading = ref(false);

async function loadProfile() {
  const h = handle.value.startsWith('@') ? handle.value : `@${handle.value}`;
  await searchRemoteUser(h);

  // Load their content from federated timeline
  if (searchResult.value) {
    contentLoading.value = true;
    try {
      const domain = searchResult.value.instanceDomain;
      const data = await $fetch<{ items: FederatedContentItem[]; total: number }>(
        '/api/federation/timeline',
        { params: { originDomain: domain, limit: 20 } },
      );
      content.value = data.items.filter(
        (item) => item.actor?.actorUri === searchResult.value?.actorUri,
      );
    } catch { /* no content available */ }
    contentLoading.value = false;
  }
}

useHead({ title: computed(() => searchResult.value?.displayName ?? handle.value) });

onMounted(loadProfile);

async function onFollow() {
  if (searchResult.value) await followRemoteUser(searchResult.value.actorUri);
}

async function onUnfollow() {
  if (searchResult.value) await unfollowRemoteUser(searchResult.value.actorUri);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
</script>

<template>
  <div class="cpub-remote-profile">
    <div v-if="searchLoading" class="cpub-remote-profile__loading">Loading profile...</div>
    <div v-else-if="searchError" class="cpub-remote-profile__error">{{ searchError }}</div>
    <div v-else-if="searchResult" class="cpub-remote-profile__content">
      <!-- Profile Header -->
      <div class="cpub-remote-profile__header">
        <img
          v-if="searchResult.avatarUrl"
          :src="searchResult.avatarUrl"
          :alt="searchResult.displayName ?? ''"
          class="cpub-remote-profile__avatar"
        />
        <div v-else class="cpub-remote-profile__avatar cpub-remote-profile__avatar--placeholder">
          {{ (searchResult.displayName ?? searchResult.preferredUsername ?? '?')[0]?.toUpperCase() }}
        </div>

        <div class="cpub-remote-profile__info">
          <h1 class="cpub-remote-profile__name">
            {{ searchResult.displayName ?? searchResult.preferredUsername }}
          </h1>
          <div class="cpub-remote-profile__handle">
            @{{ searchResult.preferredUsername }}@{{ searchResult.instanceDomain }}
          </div>
        </div>

        <button
          class="cpub-remote-profile__follow-btn"
          :class="{
            'cpub-remote-profile__follow-btn--following': searchResult.isFollowing,
            'cpub-remote-profile__follow-btn--pending': searchResult.isFollowPending,
          }"
          :disabled="searchResult.isFollowPending"
          @click="searchResult.isFollowing ? onUnfollow() : onFollow()"
        >
          {{ searchResult.isFollowing ? 'Following' : searchResult.isFollowPending ? 'Pending' : 'Follow' }}
        </button>
      </div>

      <p v-if="searchResult.summary" class="cpub-remote-profile__bio">
        {{ stripHtml(searchResult.summary) }}
      </p>

      <div class="cpub-remote-profile__stats">
        <span v-if="searchResult.followerCount != null"><strong>{{ searchResult.followerCount }}</strong> followers</span>
        <span v-if="searchResult.followingCount != null"><strong>{{ searchResult.followingCount }}</strong> following</span>
        <span class="cpub-remote-profile__instance">{{ searchResult.instanceDomain }}</span>
      </div>

      <!-- Content -->
      <div class="cpub-remote-profile__section-title">Content</div>

      <div v-if="contentLoading" class="cpub-remote-profile__loading">Loading content...</div>
      <div v-else-if="content.length === 0" class="cpub-remote-profile__empty">
        No federated content from this user yet.
      </div>
      <div v-else class="cpub-remote-profile__content-list">
        <FederatedContentCard
          v-for="item in content"
          :key="item.id"
          :content="item"
        />
      </div>
    </div>
    <div v-else class="cpub-remote-profile__empty">User not found.</div>
  </div>
</template>

<style scoped>
.cpub-remote-profile {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}
.cpub-remote-profile__loading,
.cpub-remote-profile__error,
.cpub-remote-profile__empty {
  text-align: center;
  color: var(--text-2);
  padding: var(--space-8) 0;
}
.cpub-remote-profile__error { color: var(--error, #f85149); }
.cpub-remote-profile__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.cpub-remote-profile__avatar {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border: 2px solid var(--border);
  flex-shrink: 0;
}
.cpub-remote-profile__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2, var(--surface2));
  color: var(--text-2);
  font-size: 1.5rem;
  font-weight: 700;
}
.cpub-remote-profile__info { flex: 1; min-width: 0; }
.cpub-remote-profile__name { font-size: var(--font-size-xl, 1.25rem); font-weight: 700; margin: 0; }
.cpub-remote-profile__handle {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--text-2);
}
.cpub-remote-profile__follow-btn {
  padding: var(--space-2) var(--space-4);
  border: 2px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  flex-shrink: 0;
}
.cpub-remote-profile__follow-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--surface-1, var(--surface));
}
.cpub-remote-profile__follow-btn--following {
  background: var(--accent);
  color: var(--surface-1, var(--surface));
}
.cpub-remote-profile__follow-btn--pending {
  border-color: var(--text-2);
  color: var(--text-2);
  cursor: default;
}
.cpub-remote-profile__bio {
  color: var(--text-2);
  line-height: 1.5;
  margin-bottom: var(--space-4);
}
.cpub-remote-profile__stats {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--text-2);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 2px solid var(--border);
}
.cpub-remote-profile__instance {
  margin-left: auto;
  font-family: var(--font-mono);
  opacity: 0.7;
}
.cpub-remote-profile__section-title {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
  margin-bottom: var(--space-4);
}
.cpub-remote-profile__content-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
