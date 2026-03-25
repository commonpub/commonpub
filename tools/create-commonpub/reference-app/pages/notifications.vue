<script setup lang="ts">
useSeoMeta({ title: 'Notifications — CommonPub' });
definePageMeta({ middleware: 'auth' });

const activeTab = ref('all');
const tabs = ['all', 'likes', 'comments', 'follows', 'system'];

const notifQuery = computed(() => ({
  type: activeTab.value === 'all' ? undefined : activeTab.value === 'likes' ? 'like' : activeTab.value === 'comments' ? 'comment' : activeTab.value === 'follows' ? 'follow' : 'system',
  limit: 50,
}));

const { data: notifData, refresh } = await useFetch('/api/notifications', {
  query: notifQuery,
  watch: [notifQuery],
  default: () => ({ items: [], total: 0 }),
});

const filteredNotifications = computed(() => notifData.value?.items ?? []);

async function markAllRead(): Promise<void> {
  await $fetch('/api/notifications/read', { method: 'POST', body: {} });
  refresh();
}

async function deleteNotification(id: string): Promise<void> {
  await $fetch(`/api/notifications/${id}`, { method: 'DELETE' });
  refresh();
}
</script>

<template>
  <div class="cpub-notifications-page">
    <div class="cpub-notif-header">
      <h1 class="cpub-section-title-lg">Notifications</h1>
      <button class="cpub-btn cpub-btn-sm cpub-btn-ghost" @click="markAllRead">
        <i class="fa-solid fa-check-double"></i> Mark all read
      </button>
    </div>

    <div class="cpub-tab-bar" style="position: static">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="cpub-tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>

    <div class="cpub-notif-list">
      <NotificationItem
        v-for="n in filteredNotifications"
        :key="n.id"
        :notification="n"
      />
      <div v-if="!filteredNotifications.length" class="cpub-empty-state">
        <div class="cpub-empty-state-icon"><i class="fa-solid fa-bell-slash"></i></div>
        <p class="cpub-empty-state-title">No notifications</p>
        <p class="cpub-empty-state-desc">You're all caught up!</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-notifications-page {
  max-width: var(--content-max-width, 960px);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.cpub-notif-list {
  border: 2px solid var(--border);
  background: var(--surface);
}
</style>
