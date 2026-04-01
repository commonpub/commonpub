<script setup lang="ts">
import type { RemoteActorProfile } from '@commonpub/server';

/** Strip HTML tags from remote content to prevent XSS. Remote actor summaries are untrusted. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

const props = defineProps<{
  actor: RemoteActorProfile;
}>();

const emit = defineEmits<{
  follow: [actorUri: string];
  unfollow: [actorUri: string];
}>();

const followLoading = ref(false);

const handle = computed(() => {
  const username = props.actor.preferredUsername ?? 'unknown';
  return `@${username}@${props.actor.instanceDomain}`;
});

const buttonLabel = computed(() => {
  if (props.actor.isFollowing) return 'Following';
  if (props.actor.isFollowPending) return 'Pending';
  return 'Follow';
});

const buttonDisabled = computed(() => {
  return followLoading.value || props.actor.isFollowPending === true;
});

async function toggleFollow() {
  followLoading.value = true;
  try {
    if (props.actor.isFollowing) {
      emit('unfollow', props.actor.actorUri);
    } else {
      emit('follow', props.actor.actorUri);
    }
  } finally {
    followLoading.value = false;
  }
}
</script>

<template>
  <div class="cpub-remote-actor-card">
    <div class="cpub-remote-actor-card__header">
      <img
        v-if="actor.avatarUrl"
        :src="actor.avatarUrl"
        :alt="`${actor.displayName ?? handle} avatar`"
        class="cpub-remote-actor-card__avatar"
        loading="lazy"
      />
      <div v-else class="cpub-remote-actor-card__avatar cpub-remote-actor-card__avatar--placeholder">
        {{ (actor.displayName ?? actor.preferredUsername ?? '?')[0]?.toUpperCase() }}
      </div>

      <div class="cpub-remote-actor-card__info">
        <div class="cpub-remote-actor-card__name">
          {{ actor.displayName ?? actor.preferredUsername ?? 'Unknown' }}
        </div>
        <div class="cpub-remote-actor-card__handle">
          {{ handle }}
        </div>
      </div>

      <button
        class="cpub-remote-actor-card__follow-btn"
        :class="{
          'cpub-remote-actor-card__follow-btn--following': actor.isFollowing,
          'cpub-remote-actor-card__follow-btn--pending': actor.isFollowPending,
        }"
        :disabled="buttonDisabled"
        :aria-label="`${buttonLabel} ${handle}`"
        @click="toggleFollow"
      >
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="actor.summary" class="cpub-remote-actor-card__bio">{{ stripHtml(actor.summary) }}</p>

    <div class="cpub-remote-actor-card__stats">
      <span v-if="actor.followerCount != null">
        <strong>{{ actor.followerCount }}</strong> followers
      </span>
      <span v-if="actor.followingCount != null">
        <strong>{{ actor.followingCount }}</strong> following
      </span>
      <span class="cpub-remote-actor-card__instance">
        {{ actor.instanceDomain }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.cpub-remote-actor-card {
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
  background: var(--surface-1);
}

.cpub-remote-actor-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cpub-remote-actor-card__avatar {
  width: 48px;
  height: 48px;
  border-radius: 0;
  object-fit: cover;
  border: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

.cpub-remote-actor-card__avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text-2);
  font-weight: 700;
  font-size: var(--font-size-lg);
}

.cpub-remote-actor-card__info {
  flex: 1;
  min-width: 0;
}

.cpub-remote-actor-card__name {
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-remote-actor-card__handle {
  font-size: var(--font-size-sm);
  color: var(--text-2);
  font-family: var(--font-mono);
}

.cpub-remote-actor-card__follow-btn {
  padding: var(--space-1) var(--space-3);
  border: var(--border-width-default) solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.cpub-remote-actor-card__follow-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--surface-1);
}

.cpub-remote-actor-card__follow-btn--following {
  background: var(--accent);
  color: var(--surface-1);
}

.cpub-remote-actor-card__follow-btn--pending {
  border-color: var(--text-2);
  color: var(--text-2);
  cursor: default;
}

.cpub-remote-actor-card__follow-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cpub-remote-actor-card__bio {
  margin-top: var(--space-3);
  color: var(--text-2);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.cpub-remote-actor-card__stats {
  margin-top: var(--space-3);
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--text-2);
}

.cpub-remote-actor-card__instance {
  margin-left: auto;
  font-family: var(--font-mono);
  opacity: 0.7;
}
</style>
