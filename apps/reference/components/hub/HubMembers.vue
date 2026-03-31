<script setup lang="ts">
import type { HubMemberViewModel } from '~/types/hub';

defineProps<{
  members: HubMemberViewModel[]
}>();
</script>

<template>
  <div v-if="members?.length" class="cpub-members-grid">
    <MemberCard
      v-for="member in members"
      :key="member.username"
      :username="member.username"
      :display-name="member.name"
      :role="(member.role as 'owner' | 'moderator' | 'member') || 'member'"
      :joined-at="new Date(member.joinedAt)"
    />
  </div>
  <div v-else class="cpub-empty-state">
    <div class="cpub-empty-state-icon"><i class="fa-solid fa-users"></i></div>
    <p class="cpub-empty-state-title">No members yet</p>
  </div>
</template>

<style scoped>
.cpub-members-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 1024px) {
  .cpub-members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 400px) {
  .cpub-members-grid { grid-template-columns: 1fr; }
}
</style>
