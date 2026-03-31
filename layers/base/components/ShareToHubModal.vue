<script setup lang="ts">
const props = defineProps<{
  contentId: string;
  contentTitle: string;
}>();

const emit = defineEmits<{
  close: [];
  shared: [hubSlug: string];
}>();

const toast = useToast();
const { data: userHubs } = useLazyFetch<{ items: Array<{ id: string; name: string; slug: string; iconUrl?: string }> }>('/api/user/hubs');
const sharing = ref(false);
const selectedHub = ref('');

async function handleShare(): Promise<void> {
  if (!selectedHub.value) return;
  sharing.value = true;
  try {
    await $fetch(`/api/hubs/${selectedHub.value}/share`, {
      method: 'POST',
      body: { contentId: props.contentId },
    });
    toast.success(`Shared to hub`);
    emit('shared', selectedHub.value);
    emit('close');
  } catch {
    toast.error('Failed to share to hub');
  } finally {
    sharing.value = false;
  }
}
</script>

<template>
  <div class="cpub-modal-backdrop" @click.self="emit('close')">
    <div class="cpub-modal-content">
      <div class="cpub-modal-header">
        <h3 class="cpub-modal-title">Share to Hub</h3>
        <button class="cpub-modal-close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <p class="cpub-modal-desc">Share "{{ contentTitle }}" to one of your hubs.</p>

      <div v-if="!userHubs?.items?.length" class="cpub-modal-empty">
        <p>You're not a member of any hubs yet.</p>
        <NuxtLink to="/hubs" class="cpub-btn cpub-btn-sm" @click="emit('close')">Browse Hubs</NuxtLink>
      </div>

      <template v-else>
        <div class="cpub-hub-picker">
          <button
            v-for="hub in userHubs.items"
            :key="hub.id"
            class="cpub-hub-pick-item"
            :class="{ selected: selectedHub === hub.slug }"
            @click="selectedHub = hub.slug"
          >
            <div class="cpub-hub-pick-icon">
              <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name" />
              <i v-else class="fa-solid fa-users"></i>
            </div>
            <span class="cpub-hub-pick-name">{{ hub.name }}</span>
            <i v-if="selectedHub === hub.slug" class="fa-solid fa-check cpub-hub-pick-check"></i>
          </button>
        </div>

        <div class="cpub-modal-actions">
          <button class="cpub-btn cpub-btn-primary" :disabled="!selectedHub || sharing" @click="handleShare">
            {{ sharing ? 'Sharing...' : 'Share to Hub' }}
          </button>
          <button class="cpub-btn" @click="emit('close')">Cancel</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cpub-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-surface-scrim, rgba(0,0,0,0.5));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cpub-modal-content {
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  max-width: 420px;
  width: 90vw;
}

.cpub-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cpub-modal-title {
  font-size: 16px;
  font-weight: 700;
}

.cpub-modal-close {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}
.cpub-modal-close:hover { color: var(--text); }

.cpub-modal-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 16px;
}

.cpub-modal-empty {
  text-align: center;
  padding: 20px 0;
  color: var(--text-faint);
  font-size: 13px;
}
.cpub-modal-empty p { margin-bottom: 12px; }

.cpub-hub-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  max-height: 240px;
  overflow-y: auto;
}

.cpub-hub-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: none;
  border: 2px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.1s;
}
.cpub-hub-pick-item:hover { border-color: var(--text-dim); }
.cpub-hub-pick-item.selected { border-color: var(--accent); background: var(--accent-bg); }

.cpub-hub-pick-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 2px solid var(--border);
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  flex-shrink: 0;
}
.cpub-hub-pick-icon img { width: 100%; height: 100%; object-fit: cover; }

.cpub-hub-pick-name {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
}

.cpub-hub-pick-check {
  color: var(--accent);
  font-size: 12px;
}

.cpub-modal-actions {
  display: flex;
  gap: 8px;
}
</style>
