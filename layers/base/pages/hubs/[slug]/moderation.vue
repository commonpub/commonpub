<script setup lang="ts">
import type { HubFlagItem } from '@commonpub/server';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();
const { hubGovernance } = useFeatures();

interface HubHeader { id: string; name: string; currentUserRole: string | null }
const { data: hub } = useLazyFetch<HubHeader>(() => `/api/hubs/${slug.value}`);
// Owner/admin of the hub OR a platform admin (root override).
const canManageAsAdmin = useCan('admin.access');
const canReview = computed(() => ['owner', 'admin'].includes(hub.value?.currentUserRole ?? '') || canManageAsAdmin.value);

const { data: flagsData, refresh, error } = useLazyFetch<{ items: HubFlagItem[] }>(
  () => `/api/hubs/${slug.value}/flags`,
  { immediate: false },
);
watch([canReview, hubGovernance], ([ok, gov]) => { if (ok && gov) refresh(); }, { immediate: true });
const flags = computed(() => flagsData.value?.items ?? []);
const openFlags = computed(() => flags.value.filter((f) => f.status === 'open'));

useSeoMeta({ title: () => `Moderation, ${hub.value?.name ?? 'Hub'}, ${useSiteName()}` });

function targetLink(f: HubFlagItem): string {
  return f.targetType === 'member' ? `/hubs/${slug.value}/members` : `/hubs/${slug.value}`;
}

async function resolve(flagId: string, status: 'dismissed' | 'actioned'): Promise<void> {
  try {
    await $fetch(`/api/hubs/${slug.value}/flags/${flagId}`, { method: 'PATCH', body: { status } });
    toast.success(status === 'actioned' ? 'Flag marked actioned' : 'Flag dismissed');
    await refresh();
  } catch {
    toast.error('Failed to resolve flag');
  }
}
</script>

<template>
  <div class="mod-page">
    <div class="mod-header">
      <NuxtLink :to="`/hubs/${slug}/members`" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> Members</NuxtLink>
      <h1 class="mod-title">Flag review</h1>
      <p class="mod-sub">Projects and members flagged by stewards. Resolving a flag does not remove anything, you decide.</p>
    </div>

    <div v-if="!hubGovernance || (hub && !canReview) || error" class="cpub-empty-state">
      <p class="cpub-empty-state-title">Not available</p>
      <p class="cpub-empty-state-desc">Only hub owners and admins can review flags.</p>
    </div>

    <template v-else>
      <div v-if="flags.length" class="mod-list">
        <div v-for="f in flags" :key="f.id" class="mod-card" :class="{ 'mod-card-resolved': f.status !== 'open' }">
          <span class="mod-target-type">{{ f.targetType }}</span>
          <div class="mod-info">
            <NuxtLink :to="targetLink(f)" class="mod-target">{{ f.targetLabel }}</NuxtLink>
            <p v-if="f.reason" class="mod-reason">{{ f.reason }}</p>
            <span class="mod-meta">
              Flagged by {{ f.flaggedBy.displayName || f.flaggedBy.username }}
              <template v-if="f.status !== 'open'"> · {{ f.status }}</template>
            </span>
          </div>
          <div v-if="f.status === 'open'" class="mod-actions">
            <button class="cpub-btn cpub-btn-sm" @click="resolve(f.id, 'dismissed')">Dismiss</button>
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="resolve(f.id, 'actioned')">Mark actioned</button>
          </div>
          <span v-else class="mod-status-badge">{{ f.status }}</span>
        </div>
      </div>
      <div v-else class="cpub-empty-state">
        <div class="cpub-empty-state-icon"><i class="fa-solid fa-flag"></i></div>
        <p class="cpub-empty-state-title">No flags</p>
        <p class="cpub-empty-state-desc">Nothing has been flagged for review.</p>
      </div>
      <p v-if="flags.length && !openFlags.length" class="mod-allclear">All open flags resolved.</p>
    </template>
  </div>
</template>

<style scoped>
.mod-page { max-width: 720px; margin: 0 auto; padding: 32px; }
.mod-header { margin-bottom: 20px; }
.mod-title { font-size: 22px; font-weight: 700; margin: 8px 0 2px; }
.mod-sub { font-size: 12px; color: var(--text-dim); max-width: 56ch; }

.mod-list { border: var(--border-width-default) solid var(--border); background: var(--surface); }
.mod-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-bottom: var(--border-width-default) solid var(--border2); }
.mod-card:last-child { border-bottom: none; }
.mod-card-resolved { opacity: 0.55; }

.mod-target-type { font-size: 9px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); padding: 2px 6px; flex-shrink: 0; margin-top: 2px; }
.mod-info { flex: 1; min-width: 0; }
.mod-target { font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; }
.mod-target:hover { color: var(--accent); }
.mod-reason { font-size: 12px; color: var(--text-dim); margin: 3px 0; }
.mod-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }

.mod-actions { display: flex; gap: 6px; flex-shrink: 0; }
.mod-status-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); border: var(--border-width-default) solid var(--border2); padding: 2px 8px; flex-shrink: 0; }

.mod-allclear { font-size: 12px; color: var(--text-faint); text-align: center; padding: 16px 0; }

@media (max-width: 640px) {
  .mod-page { padding: 16px; }
  .mod-card { flex-wrap: wrap; }
}
</style>
