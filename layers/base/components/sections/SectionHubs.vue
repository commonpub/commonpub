<script setup lang="ts">
/**
 * Built-in section: hubs — trending hubs list with join action.
 *
 * Fetches `/api/hubs?limit=N`, renders sidebar-style card. Mirrors
 * legacy `HubsSection.vue`: icon, name, member count, Join CTA per row.
 *
 * Join flow:
 *   - Anonymous visitor → navigate to /auth/login?redirect=/
 *   - Authenticated → POST /api/hubs/:slug/join, flip local state to
 *     "Joined" + show toast
 *   - Failure → error toast, leave button as Join
 *
 * Non-await useFetch + reactive local `joinedHubs` set per session-158
 * pattern. `var(--*)` only.
 */
import { computed, ref } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

interface HubItem {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
  memberCount?: number | null;
  source?: 'local' | 'federated';
}

interface HubsResponse {
  items?: HubItem[];
}

interface HubsConfig extends Record<string, unknown> {
  heading: string;
  limit: number;
}

const props = defineProps<SectionRenderProps<HubsConfig>>();

const apiQuery = computed(() => ({
  limit: Math.min(Math.max(props.config.limit, 1), 20),
}));

const { data: hubs, pending } = useFetch<HubsResponse>(
  '/api/hubs',
  {
    query: apiQuery,
    key: `section-hubs:${JSON.stringify(apiQuery.value)}`,
  },
);

const items = computed(() => hubs.value?.items ?? []);
const isEmpty = computed(() => !pending.value && items.value.length === 0);

const { user } = useAuth();
const isAuthenticated = computed(() => !!user.value);
const joinedHubs = ref(new Set<string>());
const toast = useToast();

async function handleHubJoin(hubSlug: string): Promise<void> {
  if (!isAuthenticated.value) {
    await navigateTo('/auth/login?redirect=/');
    return;
  }
  try {
    await $fetch(`/api/hubs/${hubSlug}/join`, { method: 'POST' });
    joinedHubs.value.add(hubSlug);
    toast.success('Joined hub!');
  } catch {
    toast.error('Failed to join hub');
  }
}

function hubHref(hub: HubItem): string {
  return hub.source === 'federated' ? `/federated-hubs/${hub.id}` : `/hubs/${hub.slug}`;
}
</script>

<template>
  <section
    class="cpub-section-hubs"
    :aria-labelledby="config.heading ? `section-hubs-${meta.sectionId}` : undefined"
  >
    <header
      v-if="config.heading"
      class="cpub-section-hubs-header"
    >
      <h2
        :id="`section-hubs-${meta.sectionId}`"
        class="cpub-section-hubs-heading"
      >
        {{ config.heading }}
      </h2>
      <NuxtLink to="/hubs" class="cpub-section-hubs-browse">Browse</NuxtLink>
    </header>

    <div v-if="pending" class="cpub-section-hubs-loading">
      <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
    </div>

    <ul v-else-if="!isEmpty" class="cpub-section-hubs-list">
      <li v-for="hub in items" :key="hub.id" class="cpub-section-hubs-item">
        <div class="cpub-section-hubs-icon">
          <img v-if="hub.iconUrl" :src="hub.iconUrl" :alt="hub.name" />
          <i v-else class="fa-solid fa-users" aria-hidden="true" />
        </div>
        <div class="cpub-section-hubs-info">
          <NuxtLink :to="hubHref(hub)" class="cpub-section-hubs-name">{{ hub.name }}</NuxtLink>
          <div class="cpub-section-hubs-members">{{ hub.memberCount ?? 0 }} members</div>
        </div>
        <button
          v-if="joinedHubs.has(hub.slug)"
          type="button"
          class="cpub-section-hubs-joined"
          disabled
          :aria-label="`Already joined ${hub.name}`"
        >
          <i class="fa-solid fa-check" aria-hidden="true" /> Joined
        </button>
        <button
          v-else
          type="button"
          class="cpub-section-hubs-join"
          :aria-label="`Join ${hub.name}`"
          @click.prevent="handleHubJoin(hub.slug)"
        >
          Join
        </button>
      </li>
    </ul>

    <p v-else class="cpub-section-hubs-empty">No hubs yet.</p>
  </section>
</template>

<style scoped>
.cpub-section-hubs {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-4);
}
.cpub-section-hubs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border-soft);
  margin-bottom: var(--space-3);
}
.cpub-section-hubs-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
}
.cpub-section-hubs-browse {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  color: var(--accent);
  text-decoration: none;
}
.cpub-section-hubs-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cpub-section-hubs-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: var(--border-width-default) solid var(--border-soft);
}
.cpub-section-hubs-item:last-child { border-bottom: none; }

.cpub-section-hubs-icon {
  width: 32px;
  height: 32px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--accent);
  flex-shrink: 0;
  overflow: hidden;
}
.cpub-section-hubs-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cpub-section-hubs-info { flex: 1; min-width: 0; }
.cpub-section-hubs-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  display: block;
}
.cpub-section-hubs-name:hover { color: var(--accent); }
.cpub-section-hubs-members {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  color: var(--text-faint);
}
.cpub-section-hubs-join,
.cpub-section-hubs-joined {
  font-family: var(--font-mono);
  font-size: var(--text-xxs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--accent);
  color: var(--accent);
  background: none;
  cursor: pointer;
}
.cpub-section-hubs-join:hover { background: var(--accent-bg); }
.cpub-section-hubs-joined {
  border-color: var(--green-border);
  color: var(--green);
  background: var(--green-bg);
  cursor: default;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.cpub-section-hubs-loading,
.cpub-section-hubs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
