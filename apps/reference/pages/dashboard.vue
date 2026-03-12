<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

useSeoMeta({
  title: 'Dashboard — CommonPub',
  description: 'Your personal CommonPub dashboard.',
});

const { user } = useAuth();

const { data: myContent } = await useFetch('/api/content', {
  query: { status: undefined, authorId: user.value?.id },
});
</script>

<template>
  <div class="dashboard-page">
    <div class="dashboard-header">
      <h1 class="dashboard-title">Dashboard</h1>
      <NuxtLink to="/create" class="cpub-create-btn">Create</NuxtLink>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-card">
        <h2 class="card-heading">My Content</h2>
        <template v-if="myContent?.items?.length">
          <div class="content-row" v-for="item in myContent.items" :key="item.id">
            <NuxtLink :to="`/${item.type}/${item.slug}`" class="content-row-title">{{ item.title }}</NuxtLink>
            <span class="content-row-status" :class="`status-${item.status}`">{{ item.status }}</span>
          </div>
        </template>
        <p class="card-empty" v-else>You haven't created any content yet.</p>
      </section>

      <section class="dashboard-card">
        <h2 class="card-heading">Stats</h2>
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-number">{{ myContent?.total ?? 0 }}</span>
            <span class="stat-label">Posts</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: var(--content-max-width);
}

.dashboard-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.cpub-create-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--color-on-primary);
  border: 1px solid var(--border);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
}

.cpub-create-btn:hover {
  opacity: 0.9;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.dashboard-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.card-heading {
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-3);
}

.card-empty {
  color: var(--text-faint);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-6) 0;
}

.content-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.content-row-title {
  color: var(--text);
  text-decoration: none;
  font-size: var(--text-sm);
}

.content-row-title:hover {
  color: var(--accent);
}

.content-row-status {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.status-published {
  background: var(--green-bg, var(--surface2));
  color: var(--green, var(--text));
}

.status-draft {
  background: var(--surface2);
  color: var(--text-dim);
}

.stats-row {
  display: flex;
  gap: var(--space-6);
  justify-content: center;
  padding: var(--space-4) 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.stat-number {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
