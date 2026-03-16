<script setup lang="ts">
const route = useRoute();
const conversationId = route.params.conversationId as string;

useSeoMeta({ title: 'Message — CommonPub' });
definePageMeta({ middleware: 'auth' });

const { user } = useAuth();

const { data: messages, refresh } = await useFetch(`/api/messages/${conversationId}`, {
  default: () => [] as Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
    readAt: string | null;
  }>,
});

async function handleSend(text: string): Promise<void> {
  await $fetch(`/api/messages/${conversationId}`, {
    method: 'POST',
    body: { body: text },
  });
  refresh();
}
</script>

<template>
  <div class="cpub-message-view">
    <div class="cpub-message-topbar">
      <NuxtLink to="/messages" class="cpub-btn cpub-btn-sm cpub-btn-ghost">
        <i class="fa-solid fa-arrow-left"></i> Back
      </NuxtLink>
      <span style="font-size: 13px; font-weight: 600">Conversation</span>
    </div>
    <MessageThread
      :messages="messages"
      :current-user-id="(user as any)?.id || ''"
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
