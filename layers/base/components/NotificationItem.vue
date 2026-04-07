<script setup lang="ts">
defineProps<{
  notification: {
    id: string;
    type: string;
    message: string;
    actorName?: string | null;
    actorAvatarUrl?: string | null;
    link?: string | null;
    targetUrl?: string;
    read: boolean;
    createdAt: string;
  };
}>();

const iconMap: Record<string, string> = {
  like: 'fa-solid fa-heart',
  comment: 'fa-solid fa-comment',
  follow: 'fa-solid fa-user-plus',
  mention: 'fa-solid fa-at',
  system: 'fa-solid fa-bell',
  hub: 'fa-solid fa-users',
  fork: 'fa-solid fa-code-fork',
  build: 'fa-solid fa-hammer',
  contest: 'fa-solid fa-trophy',
  certificate: 'fa-solid fa-certificate',
};
</script>

<template>
  <div class="cpub-notif" :class="{ 'cpub-notif-unread': !notification.read }">
    <div class="cpub-notif-avatar-wrap">
      <img v-if="notification.actorAvatarUrl" :src="notification.actorAvatarUrl" :alt="notification.actorName ?? ''" class="cpub-notif-avatar" />
      <div v-else class="cpub-notif-avatar cpub-notif-avatar-fallback">
        {{ (notification.actorName ?? '?').charAt(0).toUpperCase() }}
      </div>
      <div class="cpub-notif-icon-badge">
        <i :class="iconMap[notification.type] || 'fa-solid fa-bell'"></i>
      </div>
    </div>
    <div class="cpub-notif-body">
      <p class="cpub-notif-text">
        <strong v-if="notification.actorName">{{ notification.actorName }}</strong>
        {{ notification.message }}
      </p>
      <time class="cpub-notif-time">
        {{ new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
      </time>
    </div>
    <NuxtLink v-if="notification.link || notification.targetUrl" :to="notification.link || notification.targetUrl || '#'" class="cpub-notif-link" :aria-label="`View ${notification.type} notification`">
      <i class="fa-solid fa-arrow-right"></i>
    </NuxtLink>
  </div>
</template>

<style scoped>
.cpub-notif {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: var(--border-width-default) solid transparent;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-notif.cpub-notif-unread {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.cpub-notif-avatar-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.cpub-notif-avatar {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border: var(--border-width-default) solid var(--border);
}

.cpub-notif-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
}

.cpub-notif-icon-badge {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: 50%;
  font-size: 8px;
  color: var(--text-dim);
}

.cpub-notif-body {
  flex: 1;
  min-width: 0;
}

.cpub-notif-text {
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
}

.cpub-notif-time {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-notif-link {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
  text-decoration: none;
  font-size: 10px;
}

.cpub-notif-link:hover {
  color: var(--accent);
}
</style>
