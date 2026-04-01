<script setup lang="ts">
useSeoMeta({ title: `Messages — ${useSiteName()}` });
definePageMeta({ middleware: 'auth' });

interface ParticipantRef {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ConversationItem {
  id: string;
  participants: ParticipantRef[];
  lastMessage: string | null;
  lastMessageAt: string;
  createdAt: string;
  unread?: boolean;
}

const { data: conversations, refresh } = await useFetch<ConversationItem[]>('/api/messages', {
  default: () => [] as ConversationItem[],
});

const showNewDialog = ref(false);
const newRecipient = ref('');
const newMessage = ref('');

const msgError = ref('');

async function startConversation(): Promise<void> {
  if (!newRecipient.value.trim()) return;
  msgError.value = '';
  try {
    const conv = await $fetch<{ id: string }>('/api/messages', {
      method: 'POST',
      body: { participants: [newRecipient.value.trim()] },
    });
    if (newMessage.value.trim()) {
      await $fetch(`/api/messages/${conv.id}`, {
        method: 'POST',
        body: { body: newMessage.value.trim() },
      });
    }
    showNewDialog.value = false;
    newRecipient.value = '';
    newMessage.value = '';
    await navigateTo(`/messages/${conv.id}`);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; message?: string };
    msgError.value = fetchErr?.data?.statusMessage || fetchErr?.message || 'Failed to start conversation';
  }
}
</script>

<template>
  <div class="cpub-messages-page">
    <div class="cpub-messages-header">
      <h1 class="cpub-section-title-lg">Messages</h1>
      <button class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="showNewDialog = true">
        <i class="fa-solid fa-pen"></i> New Message
      </button>
    </div>

    <!-- New conversation dialog -->
    <div v-if="showNewDialog" class="cpub-new-msg-overlay" @click.self="showNewDialog = false">
      <div class="cpub-new-msg-dialog" role="dialog" aria-label="New message">
        <div class="cpub-new-msg-header">
          <h2 class="cpub-new-msg-title">New Conversation</h2>
          <button class="cpub-new-msg-close" @click="showNewDialog = false" aria-label="Close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="cpub-new-msg-body">
          <div class="cpub-new-msg-field">
            <label class="cpub-new-msg-label">Recipient username</label>
            <input v-model="newRecipient" type="text" class="cpub-new-msg-input" placeholder="username or @user@remote-instance.com" />
          </div>
          <div class="cpub-new-msg-field">
            <label class="cpub-new-msg-label">Message (optional)</label>
            <textarea v-model="newMessage" class="cpub-new-msg-textarea" rows="3" placeholder="Write a message..." />
          </div>
        </div>
        <div class="cpub-new-msg-footer">
          <button class="cpub-btn cpub-btn-sm" @click="showNewDialog = false">Cancel</button>
          <button
            class="cpub-btn cpub-btn-sm cpub-btn-primary"
            :disabled="!newRecipient.trim()"
            @click="startConversation"
          >
            Start Conversation
          </button>
        </div>
      </div>
    </div>

    <div class="cpub-conversation-list">
      <NuxtLink
        v-for="conv in conversations"
        :key="conv.id"
        :to="`/messages/${conv.id}`"
        class="cpub-conversation-item"
        :class="{ unread: conv.unread }"
      >
        <div class="cpub-conv-avatar">
          <img v-if="conv.participants?.[0]?.avatarUrl" :src="conv.participants[0].avatarUrl" :alt="conv.participants[0].displayName || conv.participants[0].username" class="cpub-conv-avatar-img" />
          <span v-else>{{ (conv.participants?.[0]?.displayName || conv.participants?.[0]?.username || '?').charAt(0).toUpperCase() }}</span>
        </div>
        <div class="cpub-conv-info">
          <div class="cpub-conv-name">{{ conv.participants?.map(p => p.displayName || p.username).join(', ') ?? 'Unknown' }}</div>
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
  max-width: var(--content-max-width, 960px);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

.cpub-messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.cpub-conversation-list {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  border-bottom: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  flex-shrink: 0;
  overflow: hidden;
}

.cpub-conv-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

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

/* New message dialog */
.cpub-new-msg-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay-bg, var(--color-surface-overlay-light));
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-new-msg-dialog {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-xl);
  width: 400px;
  max-width: 90vw;
}

.cpub-new-msg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-new-msg-title {
  font-size: 14px;
  font-weight: 600;
}

.cpub-new-msg-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}

.cpub-new-msg-close:hover {
  color: var(--text);
}

.cpub-new-msg-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cpub-new-msg-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-new-msg-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cpub-new-msg-input,
.cpub-new-msg-textarea {
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 8px 10px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.cpub-new-msg-input:focus,
.cpub-new-msg-textarea:focus {
  border-color: var(--accent);
}

.cpub-new-msg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: var(--border-width-default) solid var(--border);
}

@media (max-width: 768px) {
  .cpub-messages-page { padding: 16px; }
  .cpub-conversation-item { padding: 10px 12px; }
}
</style>
