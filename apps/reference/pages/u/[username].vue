<script setup lang="ts">
const route = useRoute();
const username = computed(() => route.params.username as string);

const { data: profile } = await useFetch(() => `/api/users/${username.value}`);
const { data: userContent } = await useFetch(() => `/api/users/${username.value}/content`);

useSeoMeta({
  title: () => profile.value ? `@${profile.value.username} — CommonPub` : 'User — CommonPub',
  description: () => profile.value?.bio || `Profile for ${username.value}`,
});
</script>

<template>
  <div class="profile-page" v-if="profile">
    <header class="profile-header">
      <div class="profile-avatar" />
      <div class="profile-info">
        <h1 class="profile-name">{{ profile.displayName || `@${profile.username}` }}</h1>
        <p class="profile-handle">@{{ profile.username }}</p>
        <p class="profile-bio" v-if="profile.bio">{{ profile.bio }}</p>
      </div>
    </header>

    <div class="profile-stats">
      <div class="stat">
        <span class="stat-value">{{ profile.stats?.projects ?? 0 }}</span>
        <span class="stat-label">Projects</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ profile.stats?.followers ?? 0 }}</span>
        <span class="stat-label">Followers</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ profile.stats?.following ?? 0 }}</span>
        <span class="stat-label">Following</span>
      </div>
    </div>

    <section class="profile-content">
      <h2 class="section-title">Content</h2>
      <template v-if="userContent?.length">
        <div class="profile-content-card" v-for="item in userContent" :key="item.id">
          <NuxtLink :to="`/${item.type}/${item.slug}`" class="profile-content-link">
            <span class="profile-content-type">{{ item.type }}</span>
            {{ item.title }}
          </NuxtLink>
        </div>
      </template>
      <p class="empty-state" v-else>No content published yet.</p>
    </section>
  </div>
  <div v-else class="not-found">
    <h1>User not found</h1>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: var(--content-max-width);
}

.profile-header {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  margin-bottom: var(--space-6);
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: var(--surface2);
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-1);
}

.profile-handle {
  font-size: var(--text-sm);
  color: var(--text-faint);
  margin-bottom: var(--space-1);
}

.profile-bio {
  color: var(--text-dim);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.profile-stats {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
}

.empty-state {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-8) 0;
}

.profile-content-card {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.profile-content-link {
  color: var(--text);
  text-decoration: none;
  font-size: var(--text-sm);
}

.profile-content-link:hover {
  color: var(--accent);
}

.profile-content-type {
  text-transform: capitalize;
  color: var(--accent);
  font-size: var(--text-xs);
  margin-right: var(--space-2);
}

.not-found {
  text-align: center;
  padding: var(--space-10) 0;
  color: var(--text-dim);
}
</style>
