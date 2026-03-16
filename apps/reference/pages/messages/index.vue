<script setup lang="ts">
useSeoMeta({ title: 'Messages — CommonPub' });
definePageMeta({ middleware: 'auth' });

const { data: conversations, refresh } = await useFetch('/api/messages', {
  default: () => [] as Array<{
    id: string;
    participants: string[];
    lastMessage: string | null;
    lastMessageAt: string;
    createdAt: string;
  }>,
});

const showNewDialog = ref(false);
const newRecipient = ref('');
const newMessage = ref('');

async function startConversation(): Promise<void> {
  if (!newRecipient.value.trim()) return;
  const conv = await $fetch('/api/messages', {
    method: 'POST',
    body: { participants: [newRecipient.value.trim()] },
  });
  if (newMessage.value.trim()) {
    await $fetch(`/api/messages/${(conv as any).id}`, {
      method: 'POST',
      body: { body: newMessage.value.trim() },
    });
  }
  showNewDialog.value = false;
  newRecipient.value = '';
  newMessage.value = '';
  refresh();
};
</script>

<template>
  <div class="cpub-messages-page">
    <div class="cpub-messages-header">
      <h1 class="cpub-section-title-lg">Messages</h1>
      <button class="cpub-btn cpub-btn-sm cpub-btn-primary">
        <i class="fa-solid fa-pen"></i> New Message
      </button>
    </div>

    <div class="cpub-conversation-list">
      <NuxtLink
        v-for="conv in conversations"
        :key="conv.id"
        :to="`/messages/${conv.id}`"
        class="cpub-conversation-item"
        :class="{ unread: conv.unread }"
      >
        <div class="cpub-conv-avatar">{{ (conv.participants?.[0] ?? '?').charAt(0).toUpperCase() }}</div>
        <div class="cpub-conv-info">
          <div class="cpub-conv-name">{{ conv.participants?.join(', ') ?? 'Unknown' }}</div>
          <div class="cpub-conv-preview">{{ conv.lastMessage ?? 'No messages yet' }}</div>
        </div>
        <time class="cpub-conv-time">
          {{ new Date(conv.lastMessageAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
        </time>
      </NuxtLink>

      <div v-if="!conversations.length" class="cpub-empty-state">
        <div class="cpub-empty-state-icon"><i class="fa-solid fa-envelope"></i></div>
        <p class="cpub-empty-state-title">No messages</p>
        <p class="cpub-empty-state-desc">Start a conversation with someone!</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-messages-page {
  max-width: 720px;
}

.cpub-messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.cpub-conversation-list {
  border: 2px solid var(--border);
  background: var(--surface);
}

.cpub-conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  border-bottom: 1px solid var(--border2);
  transition: background 0.1s;
}

.cpub-conversation-item:hover {
  background: var(--surface2);
}

.cpub-conversation-item.unread {
  background: var(--accent-bg);
}

.cpub-conv-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--surface3);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-conv-info {
  flex: 1;
  min-width: 0;
}

.cpub-conv-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 2px;
}

.cpub-conv-preview {
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-conv-time {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
</style>
