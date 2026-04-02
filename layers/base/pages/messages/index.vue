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
  unreadCount?: number;
}

const { user } = useAuth();
const { data: conversations, refresh } = await useFetch<ConversationItem[]>('/api/messages', {
  default: () => [] as ConversationItem[],
});

/** Filter out the current user from participants for display */
function otherParticipants(conv: ConversationItem): ParticipantRef[] {
  const others = conv.participants.filter(p => p.username !== user.value?.username);
  return others.length > 0 ? others : conv.participants;
}

const showNewDialog = ref(false);
const newRecipientInput = ref('');
const newRecipients = ref<string[]>([]);
const newMessage = ref('');

const msgError = ref('');

function addRecipient(): void {
  const val = newRecipientInput.value.trim();
  if (!val) return;
  if (newRecipients.value.includes(val)) return;
  newRecipients.value.push(val);
  newRecipientInput.value = '';
}

function removeRecipient(idx: number): void {
  newRecipients.value.splice(idx, 1);
}

async function startConversation(): Promise<void> {
  // Add any pending input as a recipient
  if (newRecipientInput.value.trim()) addRecipient();
  if (!newRecipients.value.length) return;
  msgError.value = '';
  try {
    const conv = await $fetch<{ id: string }>('/api/messages', {
      method: 'POST',
      body: { participants: newRecipients.value },
    });
    if (newMessage.value.trim()) {
      await $fetch(`/api/messages/${conv.id}` as string, {
        method: 'POST',
        body: { body: newMessage.value.trim() },
      });
    }
    showNewDialog.value = false;
    newRecipients.value = [];
    newRecipientInput.value = '';
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
    <div v-if="showNewDialog" class="cpub-new-msg-overlay" @click.self="showNewDialog = false" @keydown.escape="showNewDialog = false">
      <div class="cpub-new-msg-dialog" role="dialog" aria-label="New message">
        <div class="cpub-new-msg-header">
          <h2 class="cpub-new-msg-title">New Conversation</h2>
          <button class="cpub-new-msg-close" @click="showNewDialog = false" aria-label="Close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="cpub-new-msg-body">
          <div v-if="msgError" class="cpub-new-msg-error" role="alert">{{ msgError }}</div>
          <div class="cpub-new-msg-field">
            <label class="cpub-new-msg-label">Recipients</label>
            <div v-if="newRecipients.length" class="cpub-new-msg-chips">
              <span v-for="(r, idx) in newRecipients" :key="idx" class="cpub-new-msg-chip">
                {{ r }}
                <button class="cpub-new-msg-chip-remove" @click="removeRecipient(idx)" :aria-label="`Remove ${r}`">&times;</button>
              </span>
            </div>
            <input
              v-model="newRecipientInput"
              type="text"
              class="cpub-new-msg-input"
              placeholder="username or @user@remote-instance.com"
              @keydown.enter.prevent="addRecipient"
              @keydown.,.prevent="addRecipient"
            />
            <p class="cpub-new-msg-hint">Press Enter to add multiple recipients</p>
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
            :disabled="!newRecipients.length && !newRecipientInput.trim()"
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
        :class="{ 'cpub-conv-unread': (conv.unreadCount ?? 0) > 0 }"
        :aria-label="`Conversation with ${otherParticipants(conv).map(p => p.displayName || p.username).join(', ')}${(conv.unreadCount ?? 0) > 0 ? `, ${conv.unreadCount} unread` : ''}`"
      >
        <div v-if="otherParticipants(conv).length <= 1" class="cpub-conv-avatar">
          <img v-if="otherParticipants(conv)[0]?.avatarUrl" :src="otherParticipants(conv)[0].avatarUrl!" :alt="otherParticipants(conv)[0].displayName ?? otherParticipants(conv)[0].username ?? ''" class="cpub-conv-avatar-img" />
          <span v-else>{{ (otherParticipants(conv)[0]?.displayName || otherParticipants(conv)[0]?.username || '?').charAt(0).toUpperCase() }}</span>
        </div>
        <div v-else class="cpub-conv-avatar-group">
          <div v-for="(p, idx) in otherParticipants(conv).slice(0, 4)" :key="idx" class="cpub-conv-avatar-mini">
            <img v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.displayName || p.username" class="cpub-conv-avatar-img" />
            <span v-else>{{ (p.displayName || p.username || '?').charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="cpub-conv-info">
          <div class="cpub-conv-name">
            {{ otherParticipants(conv).map(p => p.displayName || p.username).join(', ') }}
            <span v-if="otherParticipants(conv).length > 2" class="cpub-conv-group-count">({{ otherParticipants(conv).length }})</span>
          </div>
          <div class="cpub-conv-preview">{{ conv.lastMessage ?? 'No messages yet' }}</div>
        </div>
        <div class="cpub-conv-meta">
          <time class="cpub-conv-time">
            {{ new Date(conv.lastMessageAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
          </time>
          <span v-if="(conv.unreadCount ?? 0) > 0" class="cpub-conv-badge" :aria-label="`${conv.unreadCount} unread messages`">{{ conv.unreadCount }}</span>
        </div>
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

.cpub-conversation-item.cpub-conv-unread {
  background: var(--accent-bg);
}

.cpub-conv-avatar {
  width: 36px;
  height: 36px;
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

.cpub-conv-avatar-img { width: 100%; height: 100%; object-fit: cover; }

/* Group avatar stack */
.cpub-conv-avatar-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 36px;
  height: 36px;
  gap: 1px;
  flex-shrink: 0;
  border: var(--border-width-default) solid var(--border);
  overflow: hidden;
}

.cpub-conv-avatar-mini {
  background: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  color: var(--text-dim);
  overflow: hidden;
}

.cpub-conv-avatar-mini .cpub-conv-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.cpub-conv-group-count {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-weight: 400;
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

.cpub-conv-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.cpub-conv-time {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-conv-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--accent);
  color: var(--color-text-inverse);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  border-radius: var(--radius);
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

.cpub-new-msg-error {
  padding: 8px 10px;
  background: var(--red-bg);
  color: var(--red);
  border: var(--border-width-default) solid var(--red);
  font-size: 12px;
  border-radius: var(--radius);
}

.cpub-new-msg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.cpub-new-msg-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border, var(--border));
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 11px;
}

.cpub-new-msg-chip-remove {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
}

.cpub-new-msg-chip-remove:hover {
  color: var(--red);
}

.cpub-new-msg-hint {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-top: 2px;
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
