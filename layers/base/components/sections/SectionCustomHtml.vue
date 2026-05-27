<script setup lang="ts">
/**
 * Built-in section: custom-html — admin-only raw HTML escape hatch.
 *
 * **SECURITY**: renders `config.html` via `v-html` with no runtime
 * sanitization. Intentional Phase-1c posture — matches the legacy
 * `CustomHtmlSection.vue` security baseline that already ships in
 * production. Threat-model + Phase 6b sanitization plan live in the
 * section definition file (`builtin/custom-html.ts`) and
 * `docs/plans/layout-and-pages.md §6.5`.
 *
 * Only trusted admin users can write to this section via
 * `/api/admin/layouts/*` (gated on `requireAdmin(event)`). A compromised
 * admin account → stored XSS — that's the gap we're documenting +
 * tracking, not the gap we're closing this session.
 *
 * `var(--*)` only.
 */
import type { SectionRenderProps } from '@commonpub/ui';

interface CustomHtmlConfig extends Record<string, unknown> {
  heading: string;
  html: string;
}

const props = defineProps<SectionRenderProps<CustomHtmlConfig>>();
void props;  // template uses config + meta directly via `<script setup>`
</script>

<template>
  <section
    v-if="config.html"
    class="cpub-section-custom-html"
    :aria-labelledby="config.heading ? `section-custom-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-custom-${meta.sectionId}`"
      class="cpub-section-custom-html-heading"
    >
      {{ config.heading }}
    </h2>
    <!-- v-html: see security note in source. Trusted admin input only. -->
    <div class="cpub-section-custom-html-body" v-html="config.html" />
  </section>
</template>

<style scoped>
.cpub-section-custom-html {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-custom-html-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border);
}
.cpub-section-custom-html-body {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text);
}
</style>
