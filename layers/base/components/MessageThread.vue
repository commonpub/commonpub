<script setup lang="ts">
defineProps<{
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
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
        :class="{ own: msg.senderId === currentUserId }"
      >
        <div class="cpub-msg-bubble">{{ msg.body }}</div>
        <time class="cpub-msg-time">
          {{ new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
        </time>
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
      <button class="cpub-btn cpub-btn-primary" :disabled="!newMessage.trim()" @click="handleSend">
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

.cpub-msg.own {
  align-self: flex-end;
}

.cpub-msg-bubble {
  padding: 8px 12px;
  font-size: 13px;
  background: var(--surface);
  border: 2px solid var(--border);
  line-height: 1.5;
}

.cpub-msg.own .cpub-msg-bubble {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.cpub-msg-time {
  font-size: 9px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  margin-top: 2px;
  display: block;
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
  border-top: 2px solid var(--border);
  background: var(--surface);
}

.cpub-thread-input .cpub-input {
  flex: 1;
}
</style>
