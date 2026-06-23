<script setup lang="ts">
import type { Serialized, ContestDetail, ContestEntryItem, EntryPrivateData } from '@commonpub/server';
import type { ContestStage } from '@commonpub/schema';

// Entry detail: the content summary plus the entry's per-stage artifacts in a
// stage timeline (the proposal, then the prototype, ...), with scores when the
// viewer is privileged. Artifacts are server-gated: judges/owner/admin and the
// entrant get them; everyone else sees the content card only.

const route = useRoute();
const slug = route.params.slug as string;
const entryId = route.params.entryId as string;

const { data: contest } = useLazyFetch<Serialized<ContestDetail>>(`/api/contests/${slug}`);
const { data: entry, error } = useLazyFetch<Serialized<ContestEntryItem>>(`/api/contests/${slug}/entries/${entryId}`);

useSeoMeta({
  title: () => `${entry.value?.contentTitle || 'Entry'}, ${contest.value?.title || 'Contest'}, ${useSiteName()}`,
});

const stages = computed<ContestStage[]>(() => {
  const c = contest.value;
  if (!c) return [];
  return normalizeStages({
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    judgingEndDate: c.judgingEndDate ?? null,
    stages: c.stages,
    currentStageId: c.currentStageId,
  });
});

// One timeline item per stage the entry has an artifact for, in stage order
// (artifacts for stages no longer in the timeline trail at the end, just in case).
const artifactTimeline = computed(() => {
  const subs = entry.value?.stageSubmissions ?? [];
  if (!subs.length) return [];
  const order = new Map(stages.value.map((s, i) => [s.id, i]));
  return [...subs]
    .sort((a, b) => (order.get(a.stageId) ?? 999) - (order.get(b.stageId) ?? 999))
    .map((sub) => {
      const stage = stages.value.find((s) => s.id === sub.stageId);
      const template = stage?.submissionTemplate ?? [];
      const known = new Set(template.map((f) => f.key));
      // Label values via the template; values whose field was later removed
      // from the template still render (key as the label) — never drop data.
      const rows = [
        ...template.filter((f) => sub.fields[f.key]).map((f) => ({ key: f.key, label: f.label, type: f.type, value: sub.fields[f.key]! })),
        ...Object.entries(sub.fields).filter(([k]) => !known.has(k)).map(([k, v]) => ({ key: k, label: k, type: 'text' as const, value: v })),
      ];
      return { stageId: sub.stageId, stageName: stage?.name ?? sub.stageId, submittedAt: sub.submittedAt, rows };
    });
});

const contentLink = computed(() =>
  entry.value ? `/u/${entry.value.authorUsername}/${entry.value.contentType}/${entry.value.contentSlug}` : '#',
);

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// --- Personal data (PII + agreement acceptances) ---
// Fetched CLIENT-SIDE only, so partitioned PII never lands in the SSR payload.
// The /private endpoint gates access (entrant or `contest.pii`); a 403/empty just
// leaves the section hidden, so judges + the public never see it.
const { contestPii } = useFeatures();
const privateData = ref<Serialized<EntryPrivateData> | null>(null);
const allTemplateFields = computed(() =>
  stages.value.flatMap((s) => s.submissionTemplate ?? []).map((f) => ({ key: f.key, label: f.label, type: f.type })),
);
let piiFetched = false;
async function loadPrivate(): Promise<void> {
  if (piiFetched || typeof window === 'undefined') return;
  piiFetched = true;
  try {
    const d = await $fetch<Serialized<EntryPrivateData>>(`/api/contests/${slug}/entries/${entryId}/private`);
    if (d && (Object.keys(d.fields ?? {}).length > 0 || (d.agreements ?? []).length > 0)) privateData.value = d;
  } catch {
    // 403 (not the entrant / no contest.pii) or no data → section stays hidden.
  }
}
// contestPii hydrates from /api/features on the client (DB overrides), so watch it
// rather than reading once at mount.
watch(contestPii, (on) => { if (on) void loadPrivate(); }, { immediate: true });
</script>

<template>
  <div class="cpub-entry-detail">
    <NuxtLink :to="`/contests/${slug}`" class="cpub-ed-back">
      <i class="fa-solid fa-arrow-left"></i> Back to {{ contest?.title || 'contest' }}
    </NuxtLink>

    <div v-if="error" class="cpub-ed-empty">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>Entry not found.</p>
    </div>
    <div v-else-if="!entry" class="cpub-ed-empty"><p>Loading...</p></div>

    <template v-else>
      <!-- Content summary card -->
      <header class="cpub-ed-head">
        <div class="cpub-ed-thumb">
          <img v-if="entry.contentCoverImageUrl" :src="entry.contentCoverImageUrl" :alt="entry.contentTitle" />
          <i v-else class="fa-solid fa-microchip"></i>
        </div>
        <div class="cpub-ed-headinfo">
          <h1 class="cpub-ed-title">{{ entry.contentTitle }}</h1>
          <div class="cpub-ed-meta">
            <NuxtLink :to="`/u/${entry.authorUsername}`" class="cpub-ed-author">
              <img v-if="entry.authorAvatarUrl" :src="entry.authorAvatarUrl" :alt="entry.authorName" class="cpub-ed-av" />
              <span v-else class="cpub-ed-av cpub-ed-av-init">{{ (entry.authorName || '?').charAt(0).toUpperCase() }}</span>
              {{ entry.authorName }}
            </NuxtLink>
            <span class="cpub-ed-date">Entered {{ fmtDate(entry.submittedAt) }}</span>
            <span v-if="entry.eliminated" class="cpub-ed-badge cpub-ed-out"><i class="fa-solid fa-circle-minus"></i> Not advanced</span>
            <span v-else-if="entry.stageState?.some((s) => s.status === 'advanced')" class="cpub-ed-badge cpub-ed-in"><i class="fa-solid fa-circle-check"></i> Advanced</span>
            <span v-if="entry.rank" class="cpub-ed-badge cpub-ed-rank">#{{ entry.rank }}</span>
            <span v-if="entry.score != null" class="cpub-ed-badge cpub-ed-score">Score {{ entry.score }}</span>
          </div>
          <NuxtLink :to="contentLink" class="cpub-btn cpub-btn-sm" style="margin-top: 10px;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> View the project
          </NuxtLink>
        </div>
      </header>

      <!-- Per-stage artifact timeline -->
      <section v-if="artifactTimeline.length" class="cpub-ed-stages" aria-label="Stage submissions">
        <h2 class="cpub-ed-sechead"><i class="fa-solid fa-file-pen"></i> Stage submissions</h2>
        <ol class="cpub-ed-timeline">
          <li v-for="item in artifactTimeline" :key="item.stageId" class="cpub-ed-stage">
            <div class="cpub-ed-stagehead">
              <span class="cpub-ed-stagename">{{ item.stageName }}</span>
              <span class="cpub-ed-stagedate">{{ fmtDate(item.submittedAt) }}</span>
            </div>
            <dl class="cpub-ed-fields">
              <template v-for="row in item.rows" :key="row.key">
                <dt>{{ row.label }}</dt>
                <dd>
                  <a v-if="row.type === 'url'" :href="row.value" target="_blank" rel="noopener noreferrer nofollow">{{ row.value }}</a>
                  <span v-else>{{ row.value }}</span>
                </dd>
              </template>
            </dl>
          </li>
        </ol>
      </section>

      <!-- Personal data viewer (entrant / contest.pii holders only; client-fetched). -->
      <ContestEntryPrivateData
        v-if="privateData"
        :fields="privateData.fields"
        :agreements="privateData.agreements"
        :template="allTemplateFields"
        :updated-at="privateData.updatedAt"
      />
    </template>
  </div>
</template>

<style scoped>
.cpub-entry-detail { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
.cpub-ed-back { font-size: 12px; color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
.cpub-ed-back:hover { color: var(--accent); }
.cpub-ed-empty { text-align: center; padding: 48px 0; color: var(--text-faint); font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.cpub-ed-empty i { font-size: 24px; }

.cpub-ed-head { display: flex; gap: 18px; align-items: flex-start; padding: 18px; background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); margin-bottom: 22px; }
.cpub-ed-thumb { width: 160px; aspect-ratio: 4 / 3; flex-shrink: 0; background: var(--surface2); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-faint); font-size: 22px; overflow: hidden; }
.cpub-ed-thumb img { width: 100%; height: 100%; object-fit: cover; }
.cpub-ed-headinfo { min-width: 0; }
.cpub-ed-title { font-size: 18px; font-weight: 700; margin: 0 0 6px; line-height: 1.3; }
.cpub-ed-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-ed-author { display: inline-flex; align-items: center; gap: 6px; color: var(--text-dim); text-decoration: none; }
.cpub-ed-author:hover { color: var(--accent); }
.cpub-ed-av { width: 18px; height: 18px; border-radius: 50%; border: var(--border-width-default) solid var(--border); object-fit: cover; }
.cpub-ed-av-init { display: inline-flex; align-items: center; justify-content: center; background: var(--surface3); color: var(--text-faint); font-size: 8px; }
.cpub-ed-date { color: var(--text-faint); }
.cpub-ed-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border: var(--border-width-default) solid var(--border2); background: var(--surface2); color: var(--text-dim); }
.cpub-ed-in { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-ed-out { color: var(--text-faint); }
.cpub-ed-rank { color: var(--yellow); border-color: var(--yellow); background: var(--yellow-bg); }
.cpub-ed-score { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }

.cpub-ed-sechead { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0 0 14px; }
.cpub-ed-sechead i { color: var(--accent); }
.cpub-ed-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.cpub-ed-stage { border: var(--border-width-default) solid var(--border); background: var(--surface); box-shadow: var(--shadow-md); }
.cpub-ed-stagehead { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px; border-bottom: var(--border-width-default) solid var(--border); background: var(--surface2); }
.cpub-ed-stagename { font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--accent); }
.cpub-ed-stagedate { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-ed-fields { margin: 0; padding: 14px 16px; display: grid; grid-template-columns: minmax(120px, 180px) 1fr; gap: 8px 16px; }
.cpub-ed-fields dt { font-size: 11px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.cpub-ed-fields dd { margin: 0; font-size: 13px; color: var(--text); line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
.cpub-ed-fields dd a { color: var(--accent); }

@media (max-width: 600px) {
  .cpub-ed-head { flex-direction: column; }
  .cpub-ed-thumb { width: 100%; }
  .cpub-ed-fields { grid-template-columns: 1fr; gap: 2px 0; }
  .cpub-ed-fields dd { margin-bottom: 8px; }
}
</style>
