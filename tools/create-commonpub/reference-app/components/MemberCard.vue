<script setup lang="ts">
const props = defineProps<{
  username: string;
  displayName: string;
  avatar?: string;
  role: 'owner' | 'moderator' | 'member';
  joinedAt: Date;
}>();

const roleBadgeClass = computed((): string => {
  const map: Record<string, string> = {
    owner: 'cpub-member-role-owner',
    moderator: 'cpub-member-role-mod',
    member: 'cpub-member-role-member',
  };
  return map[props.role] || 'cpub-member-role-member';
});

const joinedFormatted = computed((): string => {
  return new Date(props.joinedAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
});
</script>

<template>
  <div class="cpub-member-card">
    <div class="cpub-member-avatar-wrap">
      <div v-if="avatar" class="cpub-member-avatar">
        <img :src="avatar" :alt="displayName" />
      </div>
      <div v-else class="cpub-member-avatar cpub-member-avatar-placeholder">
        {{ displayName.charAt(0).toUpperCase() }}
      </div>
    </div>
    <div class="cpub-member-info">
      <NuxtLink :to="`/u/${username}`" class="cpub-member-name">
        {{ displayName }}
      </NuxtLink>
      <span class="cpub-member-username">@{{ username }}</span>
    </div>
    <div class="cpub-member-footer">
      <span :class="['cpub-member-role', roleBadgeClass]">{{ role }}</span>
      <span class="cpub-member-joined">Joined {{ joinedFormatted }}</span>
    </div>
  </div>
</template>

<style scoped>
.cpub-member-card {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.cpub-member-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-md);
}

.cpub-member-avatar-wrap {
  flex-shrink: 0;
}

.cpub-member-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  overflow: hidden;
  border: var(--border-width-default) solid var(--border);
}

.cpub-member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cpub-member-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-weight: var(--font-weight-bold);
  color: var(--text-dim);
}

.cpub-member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cpub-member-name {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  text-decoration: none;
  line-height: var(--leading-tight);
}

.cpub-member-name:hover {
  color: var(--accent);
}

.cpub-member-username {
  font-size: var(--text-xs);
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-member-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.cpub-member-role {
  display: inline-block;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid;
}

.cpub-member-role-owner {
  color: var(--red);
  background: var(--red-bg);
  border-color: var(--red-border);
}

.cpub-member-role-mod {
  color: var(--purple);
  background: var(--purple-bg);
  border-color: var(--purple-border);
}

.cpub-member-role-member {
  color: var(--text-faint);
  background: var(--surface2);
  border-color: var(--border2);
}

.cpub-member-joined {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
