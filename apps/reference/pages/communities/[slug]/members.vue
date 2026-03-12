<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data: members } = await useFetch(() => `/api/communities/${slug.value}/members`);

useSeoMeta({
  title: () => `Members — CommonPub`,
});
</script>

<template>
  <div class="members-page">
    <h1 class="members-title">Members</h1>
    <NuxtLink :to="`/communities/${slug}`" class="cpub-back-link">Back to community</NuxtLink>

    <div class="members-list" v-if="members?.length">
      <div class="member-card" v-for="m in members" :key="m.userId">
        <div class="member-info">
          <NuxtLink :to="`/u/${m.user.username}`" class="member-name">
            {{ m.user.displayName || m.user.username }}
          </NuxtLink>
          <span class="member-role">{{ m.role }}</span>
        </div>
        <time class="member-joined">Joined {{ new Date(m.joinedAt).toLocaleDateString() }}</time>
      </div>
    </div>
    <p class="members-empty" v-else>No members yet.</p>
  </div>
</template>

<style scoped>
.members-page {
  max-width: var(--content-max-width);
}

.members-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-2);
}

.cpub-back-link {
  color: var(--accent);
  text-decoration: none;
  font-size: var(--text-sm);
  display: inline-block;
  margin-bottom: var(--space-6);
}

.cpub-back-link:hover {
  text-decoration: underline;
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border);
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.member-name {
  color: var(--text);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
}

.member-name:hover {
  color: var(--accent);
}

.member-role {
  font-size: var(--text-xs);
  color: var(--accent);
  text-transform: capitalize;
}

.member-joined {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.members-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}
</style>
