<script setup lang="ts">
defineProps<{
  messages: Array<{
    id: string;
    senderId: string;
    senderName?: string | null;
    senderAvatarUrl?: string | null;
    body: string;
    createdAt: string;
    readAt?: string | null;
  }>;
  currentUserId: string;
}>();

const emit = defineEmits<{
  send: [message: string];
}>();

const newMessage = ref('');

function handleSend(): void {
  if (!newMessage.value.trim()) return;
  emit('send', newMessage.value);
  newMessage.value = '';
}
</script>

<template>
  <div class="cpub-thread">
    <div class="cpub-thread-messages">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="cpub-msg"
        :class="{ 'cpub-msg-own': msg.senderId === currentUserId }"
      >
        <div v-if="msg.senderId !== currentUserId" class="cpub-msg-sender">
          <img v-if="msg.senderAvatarUrl" :src="msg.senderAvatarUrl" :alt="msg.senderName ?? ''" class="cpub-msg-avatar" />
          <div v-else class="cpub-msg-avatar cpub-msg-avatar-fallback">{{ (msg.senderName ?? '?').charAt(0).toUpperCase() }}</div>
          <span v-if="msg.senderName" class="cpub-msg-name">{{ msg.senderName }}</span>
        </div>
        <div class="cpub-msg-bubble">{{ msg.body }}</div>
        <div class="cpub-msg-meta">
          <time class="cpub-msg-time">
            {{ new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
          </time>
          <span v-if="msg.senderId === currentUserId" class="cpub-msg-receipt" :class="{ 'cpub-msg-read': msg.readAt }" :title="msg.readAt ? `Read ${new Date(msg.readAt).toLocaleString()}` : 'Sent'">
            <i :class="msg.readAt ? 'fa-solid fa-check-double' : 'fa-solid fa-check'" aria-hidden="true"></i>
            <span class="sr-only">{{ msg.readAt ? 'Read' : 'Sent' }}</span>
          </span>
        </div>
      </div>
      <p v-if="!messages.length" class="cpub-thread-empty">No messages yet. Say hello!</p>
    </div>
    <div class="cpub-thread-input">
      <input
        v-model="newMessage"
        type="text"
        class="cpub-input"
        placeholder="Type a message..."
        aria-label="Message"
        @keyup.enter="handleSend"
      />
      <button class="cpub-btn cpub-btn-primary" :disabled="!newMessage.trim()" aria-label="Send message" @click="handleSend">
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-thread {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cpub-thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-msg {
  max-width: 70%;
}

.cpub-msg.cpub-msg-own {
  align-self: flex-end;
}

.cpub-msg-sender {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.cpub-msg-avatar {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.cpub-msg-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-dim);
}

.cpub-msg-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}

.cpub-msg-bubble {
  padding: 8px 12px;
  font-size: 13px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  line-height: 1.5;
}

.cpub-msg.cpub-msg-own .cpub-msg-bubble {
  background: var(--accent-bg);
  border-color: var(--accent-border, var(--border));
}

.cpub-msg-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.cpub-msg.cpub-msg-own .cpub-msg-meta {
  justify-content: flex-end;
}

.cpub-msg-time {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-msg-receipt {
  font-size: 9px;
  color: var(--text-faint);
}

.cpub-msg-receipt.cpub-msg-read {
  color: var(--accent);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.cpub-thread-empty {
  text-align: center;
  color: var(--text-faint);
  font-size: 13px;
  padding: 32px;
}

.cpub-thread-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-thread-input .cpub-input {
  flex: 1;
}
</style>
