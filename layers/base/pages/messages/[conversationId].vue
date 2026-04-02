<script setup lang="ts">
const route = useRoute();
const conversationId = route.params.conversationId as string;

definePageMeta({ middleware: 'auth' });

const { user } = useAuth();
const toast = useToast();

interface ConvParticipant {
  id: string;
  displayName?: string;
  username?: string;
}

interface MessageItem {
  id: string;
  senderId: string;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  body: string;
  createdAt: string;
}

const { data: convInfo } = useLazyFetch<{ id: string; participants: ConvParticipant[] }>(`/api/messages/${conversationId}/info`, {
  default: () => ({ id: conversationId, participants: [] }),
});

const { data: initialMessages, refresh } = useLazyFetch<MessageItem[]>(`/api/messages/${conversationId}`, {
  default: () => [],
});

const messages = ref<MessageItem[]>([]);

// Sync with lazy fetch when it resolves
watch(initialMessages, (val) => {
  if (val?.length) messages.value = [...val];
}, { immediate: true });

// SSE real-time stream
let eventSource: EventSource | null = null;

onMounted(() => {
  eventSource = new EventSource(`/api/messages/${conversationId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'init') {
        messages.value = data.messages;
      } else if (data.type === 'new') {
        for (const msg of data.messages) {
          if (!messages.value.some((m) => m.id === msg.id)) {
            messages.value.push(msg);
          }
        }
      }
    } catch { /* ignore parse errors */ }
  };

  eventSource.onerror = () => {
    // Connection lost — will auto-reconnect via EventSource spec
  };
});

onUnmounted(() => {
  eventSource?.close();
  eventSource = null;
});

const participantLabel = computed(() => {
  const parts = convInfo.value?.participants ?? [];
  if (!parts.length) return 'Conversation';
  const others = parts
    .filter((p) => p.id !== user.value?.id)
    .map((p) => p.displayName || p.username || p.id);
  return others.length > 0 ? others.join(', ') : 'Conversation';
});

useSeoMeta({ title: () => `Message — ${participantLabel.value}` });

async function handleSend(text: string): Promise<void> {
  try {
    await $fetch(`/api/messages/${conversationId}` as string, {
      method: 'POST',
      body: { body: text },
    });
    // SSE will pick up the new message, but also do an immediate refresh for responsiveness
    await refresh();
  } catch {
    toast.error('Failed to send message');
  }
}
</script>

<template>
  <div class="cpub-message-view">
    <div class="cpub-message-topbar">
      <NuxtLink to="/messages" class="cpub-btn cpub-btn-sm cpub-btn-ghost">
        <i class="fa-solid fa-arrow-left"></i> Back
      </NuxtLink>
      <span style="font-size: 13px; font-weight: 600">{{ participantLabel }}</span>
    </div>
    <MessageThread
      :messages="messages"
      :current-user-id="user?.id ?? ''"
      @send="handleSend"
    />
  </div>
</template>

<style scoped>
.cpub-message-view {
  max-width: 720px;
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.cpub-message-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: var(--border-width-default) solid var(--border);
}

@media (max-width: 768px) {
  .msg-page { padding: 12px; }
  .msg-scroll { height: calc(100vh - 160px); }
  .msg-compose { padding: 8px; }
}
</style>
