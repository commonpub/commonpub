<script setup lang="ts">
const route = useRoute();
const conversationId = route.params.conversationId as string;

useSeoMeta({ title: 'Message — CommonPub' });
definePageMeta({ middleware: 'auth' });

const { user } = useAuth();

const { data: convInfo } = useLazyFetch<any>(`/api/messages/${conversationId}/info`, {
  default: () => ({ id: conversationId, participants: [] as string[] }),
});

const { data: initialMessages, refresh } = useLazyFetch<any[]>(`/api/messages/${conversationId}`, {
  default: () => [],
});

const messages = ref([...(initialMessages.value ?? [])]);

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
  return parts.join(', ');
});

async function handleSend(text: string): Promise<void> {
  await $fetch(`/api/messages/${conversationId}`, {
    method: 'POST',
    body: { body: text },
  });
  // SSE will pick up the new message, but also do an immediate refresh for responsiveness
  refresh().then((result: any) => {
    if (result?.data?.value) {
      messages.value = result.data.value;
    }
  });
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
  border: 2px solid var(--border);
  background: var(--surface);
}

.cpub-message-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border);
}
</style>
