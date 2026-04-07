<script setup lang="ts">
import type { HubMemberViewModel } from '../../types/hub';

export interface RemoteMemberVM {
  actorUri: string;
  name: string;
  instanceDomain: string;
  avatarUrl: string | null;
}

defineProps<{
  members: HubMemberViewModel[];
  remoteMembers?: RemoteMemberVM[];
}>();
</script>

<template>
  <div>
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

    <div v-if="remoteMembers?.length" class="cpub-remote-members-section">
      <h4 class="cpub-remote-members-title"><i class="fa-solid fa-globe"></i> Federated Members</h4>
      <div class="cpub-members-grid">
        <div v-for="rm in remoteMembers" :key="rm.actorUri" class="cpub-remote-member-card">
          <div class="cpub-remote-member-avatar">
            <img v-if="rm.avatarUrl" :src="rm.avatarUrl" :alt="rm.name" class="cpub-remote-member-avatar-img" />
            <span v-else>{{ rm.name.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="cpub-remote-member-info">
            <span class="cpub-remote-member-name">{{ rm.name }}</span>
            <span class="cpub-remote-member-domain">{{ rm.instanceDomain }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!members?.length && !remoteMembers?.length" class="cpub-empty-state">
      <div class="cpub-empty-state-icon"><i class="fa-solid fa-users"></i></div>
      <p class="cpub-empty-state-title">No members yet</p>
    </div>
  </div>
</template>

<style scoped>
.cpub-members-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.cpub-remote-members-section { margin-top: 24px; }
.cpub-remote-members-title {
  font-family: var(--font-mono); font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-dim); margin-bottom: 12px;
  display: flex; align-items: center; gap: 6px;
}
.cpub-remote-members-title > i { color: var(--accent); }

.cpub-remote-member-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: var(--surface);
  border: var(--border-width-default) solid var(--border);
}
.cpub-remote-member-avatar {
  width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
  background: var(--accent-bg); display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; color: var(--accent); flex-shrink: 0;
}
.cpub-remote-member-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-remote-member-info { display: flex; flex-direction: column; min-width: 0; }
.cpub-remote-member-name { font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-remote-member-domain { font-size: 11px; color: var(--text-dim); }

@media (max-width: 1024px) {
  .cpub-members-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 400px) {
  .cpub-members-grid { grid-template-columns: 1fr; }
}
</style>
