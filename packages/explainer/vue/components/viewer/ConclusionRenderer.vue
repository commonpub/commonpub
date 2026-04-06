<script setup lang="ts">
import { computed } from 'vue';
import type { ExplainerConclusion } from '@commonpub/explainer';
import { sanitizeHtml } from '../../utils/sanitize';

const props = defineProps<{
  conclusion: ExplainerConclusion;
}>();

const sanitizedBody = computed(() => props.conclusion.body ? sanitizeHtml(props.conclusion.body) : '');
</script>

<template>
  <section class="cpub-explainer-conclusion" data-section-id="conclusion">
    <div class="cpub-explainer-conclusion-inner">
      <h2 class="cpub-conclusion-heading">{{ conclusion.heading }}</h2>
      <div class="cpub-conclusion-body" v-html="sanitizedBody" />

      <a
        v-if="conclusion.callToAction"
        :href="conclusion.callToAction.url"
        class="cpub-conclusion-cta"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ conclusion.callToAction.label }}
        <i class="fa-solid fa-arrow-right" />
      </a>
    </div>
  </section>
</template>

<style scoped>
.cpub-explainer-conclusion {
  background: var(--bg-page, #0c0c0f);
  color: var(--text-on-dark, #fff);
}

.cpub-explainer-conclusion-inner {
  max-width: var(--section-max-width, 760px);
  margin: 0 auto;
  padding: var(--section-padding, 72px 32px);
  text-align: center;
}

.cpub-conclusion-heading {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-on-dark, #fff);
  margin: 0 0 20px;
}

.cpub-conclusion-body {
  font-family: var(--font-body);
  font-size: 17px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.55));
  line-height: 1.7;
  max-width: 600px;
  margin: 0 auto 32px;
}

.cpub-conclusion-body :deep(strong) {
  color: var(--text-on-dark, #fff);
}

.cpub-conclusion-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--accent);
  color: #fff;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: var(--radius, 0px);
  transition: background 0.15s;
}

.cpub-conclusion-cta:hover {
  background: var(--accent-hover);
}

@media (max-width: 768px) {
  .cpub-explainer-conclusion-inner {
    padding: var(--section-padding-mobile, 48px 20px);
  }

  .cpub-conclusion-heading {
    font-size: 22px;
  }
}
</style>
