<script setup lang="ts">
/**
 * Built-in section: hero — banner with title, optional eyebrow + subtitle,
 * up to two CTAs.
 *
 * Phase 1c starter. Variants: `default` (left-aligned, grid backdrop),
 * `compact` (smaller padding, no backdrop), `centered` (centered text
 * + CTAs, grid backdrop).
 *
 * Intentionally does NOT replicate the existing `HomepageHeroSection`'s
 * contest-dispatch logic — that becomes its own data-aware section in
 * Phase 6b (`contest-feature` or similar). This hero is pure
 * config-driven so the editor preview is deterministic.
 *
 * `var(--*)` only.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface HeroCta {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

interface HeroConfig extends Record<string, unknown> {
  variant: 'default' | 'compact' | 'centered';
  eyebrow: string;
  title: string;
  subtitle: string;
  ctas: HeroCta[];
}

defineProps<SectionRenderProps<HeroConfig>>();
</script>

<template>
  <section
    class="cpub-section-hero"
    :data-variant="config.variant"
    :aria-labelledby="`section-hero-${meta.sectionId}`"
  >
    <div v-if="config.variant !== 'compact'" class="cpub-section-hero-grid-bg" aria-hidden="true" />
    <div class="cpub-section-hero-inner">
      <div class="cpub-section-hero-content">
        <p v-if="config.eyebrow" class="cpub-section-hero-eyebrow">{{ config.eyebrow }}</p>
        <h1
          :id="`section-hero-${meta.sectionId}`"
          class="cpub-section-hero-title"
        >
          {{ config.title }}
        </h1>
        <p v-if="config.subtitle" class="cpub-section-hero-subtitle">{{ config.subtitle }}</p>
        <div v-if="config.ctas.length > 0" class="cpub-section-hero-actions">
          <NuxtLink
            v-for="(cta, i) in config.ctas"
            :key="i"
            :to="cta.href"
            class="cpub-btn"
            :class="cta.variant === 'primary' ? 'cpub-btn-primary' : ''"
          >
            {{ cta.label }}
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-section-hero {
  position: relative;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  overflow: hidden;
  min-height: 180px;
  display: flex;
  align-items: stretch;
}
.cpub-section-hero[data-variant='compact'] {
  min-height: 120px;
  border-bottom: none;
}

.cpub-section-hero-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border2) 1px, transparent 1px),
    linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.25;
  pointer-events: none;
}

.cpub-section-hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-6);
  width: 100%;
  display: flex;
  align-items: center;
}
.cpub-section-hero[data-variant='compact'] .cpub-section-hero-inner {
  padding: var(--space-4) var(--space-6);
}

.cpub-section-hero-content { flex: 1; min-width: 0; }

.cpub-section-hero[data-variant='centered'] .cpub-section-hero-inner {
  justify-content: center;
}
.cpub-section-hero[data-variant='centered'] .cpub-section-hero-content {
  text-align: center;
  max-width: 720px;
}

.cpub-section-hero-eyebrow {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin: 0 0 var(--space-2);
}

.cpub-section-hero-title {
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1.2;
  margin: 0 0 var(--space-2);
  color: var(--text);
}
.cpub-section-hero[data-variant='compact'] .cpub-section-hero-title {
  font-size: var(--text-2xl);
}

.cpub-section-hero-subtitle {
  font-size: var(--text-md);
  color: var(--text-dim);
  line-height: 1.6;
  margin: 0 0 var(--space-4);
  max-width: 560px;
}
.cpub-section-hero[data-variant='centered'] .cpub-section-hero-subtitle {
  margin-inline: auto;
}

.cpub-section-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.cpub-section-hero[data-variant='centered'] .cpub-section-hero-actions {
  justify-content: center;
}

@media (max-width: 640px) {
  .cpub-section-hero-inner { padding: var(--space-4); }
  .cpub-section-hero-title { font-size: var(--text-2xl); }
  .cpub-section-hero-actions { width: 100%; }
}
</style>
