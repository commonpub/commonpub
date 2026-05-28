<script setup lang="ts">
import { computed } from 'vue';
import type { HomepageSectionConfig } from '@commonpub/server';

interface HeroCta {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

const props = defineProps<{ config: HomepageSectionConfig }>();

const { contests: contestsEnabled } = useFeatures();
const { data: contests } = await useFetch('/api/contests', { query: { limit: 3 }, lazy: true });

const activeContest = computed(() => {
  const items = (contests.value as { items?: Array<Record<string, unknown>> })?.items;
  return items?.find((c) => c.status === 'active') ?? null;
});

// Config-driven overrides (Stage E session 159 — finally wired). The
// legacy admin form (/admin/homepage) has accepted `customTitle` +
// `customSubtitle` for a long time, but the renderer ignored them —
// admin would type a custom title and see no change. Now respected.
//
// Hardcoded fallbacks preserve the existing "Build. Document. Share."
// + Open Source eyebrow + Start Building/Explore CTAs when admin
// hasn't customised anything.
//
// Contest-aware swap still wins when there's an active contest +
// `features.contests` is on — the contest hero is intentionally not
// overridable because it pulls live data; admins who want fully-static
// copy can either disable the contests flag or set customTitle which
// applies in the non-contest branch.
const heroTitle = computed(() => {
  const cfg = props.config as { customTitle?: string };
  return cfg.customTitle?.trim() || 'Build. Document. Share.';
});
const heroTitleIsCustom = computed(() => {
  const cfg = props.config as { customTitle?: string };
  return !!cfg.customTitle?.trim();
});
const heroSubtitle = computed(() => {
  const cfg = props.config as { customSubtitle?: string };
  return cfg.customSubtitle?.trim() ||
    'CommonPub is an open platform for maker communities. Document your builds with rich editors, join hubs, learn with structured paths, and share with the world.';
});
const heroEyebrow = computed(() => {
  const cfg = props.config as { eyebrow?: string };
  return cfg.eyebrow?.trim() || 'Open Source';
});
const heroCtas = computed<HeroCta[]>(() => {
  const cfg = props.config as { ctas?: HeroCta[] };
  if (Array.isArray(cfg.ctas) && cfg.ctas.length > 0) return cfg.ctas;
  return [
    { label: 'Start Building', href: '/create', variant: 'primary' },
    { label: 'Explore', href: '/explore', variant: 'secondary' },
  ];
});

// Shared via useState so the dismiss sticks across component remounts.
// HomepageSectionRenderer's v-if wrappers can remount HeroSection when the
// `sections` useFetch revalidates on hydration or when feature flags flip
// (they're async on first load). A local ref would reset on remount and
// the user would see the banner "come back" after dismissing — which also
// fails the navigation.spec.ts e2e test.
//
// NOTE: useState returns a Ref. Vue SFC's auto-unwrap-on-template-write
// is reliable for bindings the compiler recognizes as refs, but for
// auto-imported Nuxt composables the detection is inconsistent across
// versions — safer to set `.value` explicitly from a real handler.
const heroDismissed = useState('cpub:hero-dismissed', () => false);
function dismissHero(): void {
  heroDismissed.value = true;
}
</script>

<template>
  <section v-if="!heroDismissed" class="cpub-hero-banner">
    <div class="cpub-hero-grid-bg" />
    <div class="cpub-hero-gradient" />
    <button class="cpub-hero-dismiss" title="Dismiss" @click="dismissHero">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="cpub-hero-inner">
      <div class="cpub-hero-content">
        <template v-if="contestsEnabled && activeContest">
          <div class="cpub-hero-eyebrow">
            <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> Live Contest</span>
            <span class="cpub-hero-badge">{{ activeContest.entryCount ?? 0 }} entries</span>
          </div>
          <h1 class="cpub-hero-title">{{ activeContest.title }}</h1>
          <p v-if="activeContest.description" class="cpub-hero-excerpt">{{ activeContest.description }}</p>
          <div class="cpub-hero-actions">
            <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn cpub-btn-primary"><i class="fa-solid fa-trophy"></i> Enter Contest</NuxtLink>
            <NuxtLink :to="`/contests/${activeContest.slug}`" class="cpub-btn"><i class="fa-solid fa-circle-info"></i> View Details</NuxtLink>
          </div>
        </template>
        <template v-else>
          <div class="cpub-hero-eyebrow">
            <span class="cpub-hero-badge cpub-hero-badge-live"><span class="cpub-live-dot" /> {{ heroEyebrow }}</span>
          </div>
          <!-- When admin supplied a customTitle, show as plain text. The
               hardcoded fallback uses inline <br> + accent span for the
               canonical "Build. Document. Share." typography. -->
          <h1 v-if="heroTitleIsCustom" class="cpub-hero-title">{{ heroTitle }}</h1>
          <h1 v-else class="cpub-hero-title">Build. Document.<br><span>Share.</span></h1>
          <p class="cpub-hero-excerpt">{{ heroSubtitle }}</p>
          <div class="cpub-hero-actions">
            <NuxtLink
              v-for="(cta, i) in heroCtas"
              :key="i"
              :to="cta.href"
              class="cpub-btn"
              :class="cta.variant === 'primary' ? 'cpub-btn-primary' : ''"
            >
              {{ cta.label }}
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-hero-banner { position: relative; background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); overflow: hidden; min-height: 200px; display: flex; align-items: stretch; }
.cpub-hero-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px); background-size: 32px 32px; opacity: 0.25; }
.cpub-hero-gradient { position: absolute; inset: 0; background: var(--surface2); opacity: 0.5; }
.cpub-hero-dismiss { position: absolute; top: 12px; right: 16px; background: transparent; border: none; color: var(--text-faint); font-size: 12px; cursor: pointer; padding: 4px; z-index: 2; }
.cpub-hero-dismiss:hover { color: var(--text-dim); }
.cpub-hero-inner { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 36px 32px; width: 100%; display: flex; align-items: center; gap: 48px; }
.cpub-hero-content { flex: 1; min-width: 0; }
.cpub-hero-eyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cpub-hero-badge { font-size: 9px; font-family: var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; background: var(--yellow-bg); border: var(--border-width-default) solid var(--yellow); color: var(--yellow); }
.cpub-hero-badge-live { background: var(--green-bg); border-color: var(--green); color: var(--green); display: flex; align-items: center; gap: 5px; }
.cpub-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); animation: cpub-pulse 2s ease-in-out infinite; }
@keyframes cpub-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.cpub-hero-title { font-size: 22px; font-weight: 700; line-height: 1.25; margin-bottom: 10px; }
.cpub-hero-title span { color: var(--accent); }
.cpub-hero-excerpt { font-size: 13px; color: var(--text-dim); line-height: 1.65; margin-bottom: 20px; max-width: 560px; }
.cpub-hero-actions { display: flex; flex-wrap: wrap; gap: 8px; }

@media (max-width: 640px) {
  .cpub-hero-inner { flex-direction: column; align-items: flex-start; gap: 20px; padding: 24px 16px; }
  .cpub-hero-title { font-size: 19px; }
  .cpub-hero-excerpt { font-size: 13px; }
  .cpub-hero-actions { width: 100%; }
  .cpub-hero-actions :deep(.cpub-btn) { flex: 1 1 140px; justify-content: center; }
}
</style>
