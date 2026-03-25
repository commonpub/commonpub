<script setup lang="ts">
const route = useRoute();
const username = route.params.username as string;

useSeoMeta({ title: `Followers — @${username} — CommonPub` });

const { data: followers } = useLazyFetch<Array<{ id: string; username: string; displayName: string | null }>>(`/api/users/${username}/followers`);
const { isAuthenticated, user } = useAuth();
const toast = useToast();

const followingState = ref<Record<string, boolean>>({});

async function toggleFollow(targetUsername: string, isFollowing: boolean): Promise<void> {
  try {
    if (isFollowing) {
      await $fetch(`/api/users/${targetUsername}/follow`, { method: 'DELETE' });
      followingState.value[targetUsername] = false;
    } else {
      await $fetch(`/api/users/${targetUsername}/follow`, { method: 'POST' });
      followingState.value[targetUsername] = true;
    }
  } catch {
    toast.error('Failed to update follow');
  }
}
</script>

<template>
  <div class="follow-page">
    <div class="follow-header">
      <NuxtLink :to="`/u/${username}`" class="follow-back"><i class="fa-solid fa-arrow-left"></i> @{{ username }}</NuxtLink>
      <h1 class="follow-title">Followers</h1>
    </div>

    <div v-if="followers?.length" class="follow-list">
      <div v-for="f in (followers as Array<{ id: string; username: string; displayName: string | null }>)" :key="f.id" class="follow-item">
        <NuxtLink :to="`/u/${f.username}`" class="follow-user">
          <div class="follow-avatar">{{ (f.displayName || f.username).charAt(0).toUpperCase() }}</div>
          <div>
            <div class="follow-name">{{ f.displayName || f.username }}</div>
            <div class="follow-handle">@{{ f.username }}</div>
          </div>
        </NuxtLink>
        <button
          v-if="isAuthenticated && f.username !== user?.username"
          class="cpub-btn cpub-btn-sm"
          :class="{ 'cpub-btn-primary': !followingState[f.username] }"
          @click="toggleFollow(f.username, !!followingState[f.username])"
        >
          {{ followingState[f.username] ? 'Following' : 'Follow' }}
        </button>
      </div>
    </div>
    <div v-else class="follow-empty">
      <p>No followers yet.</p>
    </div>
  </div>
</template>

<style scoped>
.follow-page { max-width: 600px; margin: 0 auto; padding: 32px; }
.follow-header { margin-bottom: 24px; }
.follow-back { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.follow-back:hover { color: var(--accent); }
.follow-title { font-size: 22px; font-weight: 700; }

.follow-list { display: flex; flex-direction: column; }
.follow-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border2); }
.follow-item:last-child { border-bottom: none; }
.follow-user { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--text); }
.follow-user:hover .follow-name { color: var(--accent); }
.follow-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--surface3); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.follow-name { font-size: 14px; font-weight: 600; }
.follow-handle { font-size: 12px; color: var(--text-faint); font-family: var(--font-mono); }

.follow-empty { text-align: center; padding: 48px 0; color: var(--text-faint); }
</style>
