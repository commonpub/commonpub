<script setup lang="ts">
const props = defineProps<{
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

const emit = defineEmits<{ read: [id: string] }>();

// The whole row is the click target when there's somewhere to go (previously
// only the tiny right-hand arrow navigated). When there's a destination the
// root renders as a NuxtLink so keyboard / middle-click / open-in-new-tab all
// work; otherwise it stays a plain div.
const destination = computed(() => props.notification.link || props.notification.targetUrl || null);

function onActivate(): void {
  if (!props.notification.read) emit('read', props.notification.id);
}

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
  <component
    :is="destination ? 'NuxtLink' : 'div'"
    :to="destination || undefined"
    class="cpub-notif"
    :class="{ 'cpub-notif-unread': !notification.read, 'cpub-notif-link-row': destination }"
    :aria-label="destination ? `${notification.actorName ? notification.actorName + ' ' : ''}${notification.message}` : undefined"
    @click="onActivate"
  >
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
    <i v-if="destination" class="fa-solid fa-chevron-right cpub-notif-chevron" aria-hidden="true"></i>
  </component>
</template>

<style scoped>
.cpub-notif {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: var(--border-width-default) solid transparent;
  border-bottom: var(--border-width-default) solid var(--border2);
  color: inherit;
  text-decoration: none;
}

/* Whole-row link affordance: the entire item is the click target. */
.cpub-notif-link-row {
  cursor: pointer;
  transition: background 0.12s ease;
}

.cpub-notif-link-row:hover {
  background: var(--surface2);
}

.cpub-notif.cpub-notif-unread {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.cpub-notif-link-row.cpub-notif-unread:hover {
  background: var(--accent-bg-hover, var(--accent-bg));
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

/* Decorative chevron — signals the whole row navigates (the row itself is the
   link now; this is aria-hidden, not a separate tab stop). */
.cpub-notif-chevron {
  align-self: center;
  flex-shrink: 0;
  color: var(--text-faint);
  font-size: 10px;
}

.cpub-notif-link-row:hover .cpub-notif-chevron {
  color: var(--accent);
}
</style>
