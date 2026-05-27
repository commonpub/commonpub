<script setup lang="ts">
/**
 * Built-in section: cta — call-to-action panel.
 *
 * Heading + body + up to 3 buttons. Three variants:
 *   default  → boxed panel with subtle border
 *   contrast → accent-background inverse
 *   minimal  → no panel, just text + buttons
 *
 * URL safety: href values are validated at WRITE time by the section's
 * Zod schema (SAFE_LINK_URL regex). Renderer doesn't re-validate
 * because Vue's :href binding doesn't sanitise — the regex IS the guard.
 *
 * `var(--*)` only.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface CtaButton {
  label: string;
  href: string;
  variant: 'primary' | 'secondary' | 'ghost';
}

interface CtaConfig extends Record<string, unknown> {
  variant: 'default' | 'contrast' | 'minimal';
  heading: string;
  body: string;
  buttons: CtaButton[];
  align: 'left' | 'center';
}

const props = defineProps<SectionRenderProps<CtaConfig>>();
void props;
</script>

<template>
  <section
    class="cpub-section-cta"
    :data-variant="config.variant"
    :data-align="config.align"
    :aria-labelledby="`section-cta-${meta.sectionId}`"
  >
    <h2
      :id="`section-cta-${meta.sectionId}`"
      class="cpub-section-cta-heading"
    >
      {{ config.heading }}
    </h2>

    <p v-if="config.body" class="cpub-section-cta-body">
      {{ config.body }}
    </p>

    <div v-if="config.buttons.length > 0" class="cpub-section-cta-actions">
      <a
        v-for="(btn, idx) in config.buttons"
        :key="idx"
        :href="btn.href"
        :class="`cpub-section-cta-btn cpub-section-cta-btn-${btn.variant}`"
      >
        {{ btn.label }}
      </a>
    </div>
  </section>
</template>

<style scoped>
.cpub-section-cta {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
}

/* default — boxed */
.cpub-section-cta[data-variant='default'] {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
}

/* contrast — accent inverse */
.cpub-section-cta[data-variant='contrast'] {
  background: var(--accent);
  color: var(--surface);
  border: var(--border-width-default) solid var(--accent);
}
.cpub-section-cta[data-variant='contrast'] .cpub-section-cta-heading,
.cpub-section-cta[data-variant='contrast'] .cpub-section-cta-body {
  color: inherit;
}

/* minimal — no panel */
.cpub-section-cta[data-variant='minimal'] {
  background: transparent;
  border: none;
  padding: var(--space-3) 0;
}

/* align */
.cpub-section-cta[data-align='center'] {
  text-align: center;
  align-items: center;
}
.cpub-section-cta[data-align='center'] .cpub-section-cta-actions {
  justify-content: center;
}

.cpub-section-cta-heading {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.cpub-section-cta-body {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text-soft);
  margin: 0;
  max-width: 60ch;
}
.cpub-section-cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* buttons — three variants */
.cpub-section-cta-btn {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: var(--space-2) var(--space-4);
  border: var(--border-width-default) solid var(--accent);
  text-decoration: none;
  display: inline-block;
}
.cpub-section-cta-btn-primary {
  background: var(--accent);
  color: var(--surface);
}
.cpub-section-cta-btn-primary:hover {
  background: var(--accent-strong, var(--accent));
}
.cpub-section-cta-btn-secondary {
  background: transparent;
  color: var(--accent);
}
.cpub-section-cta-btn-secondary:hover {
  background: var(--accent-bg);
}
.cpub-section-cta-btn-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--text);
}
.cpub-section-cta-btn-ghost:hover {
  color: var(--accent);
}
/* Contrast variant — invert button colours so they read on accent bg */
.cpub-section-cta[data-variant='contrast'] .cpub-section-cta-btn-primary {
  background: var(--surface);
  color: var(--accent);
  border-color: var(--surface);
}
.cpub-section-cta[data-variant='contrast'] .cpub-section-cta-btn-secondary {
  border-color: var(--surface);
  color: var(--surface);
}
.cpub-section-cta[data-variant='contrast'] .cpub-section-cta-btn-ghost {
  color: var(--surface);
}
</style>
