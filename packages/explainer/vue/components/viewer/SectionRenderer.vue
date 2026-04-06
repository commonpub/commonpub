<script setup lang="ts">
import type { ExplainerDocSection } from '@commonpub/explainer';
import InteractiveContainer from './InteractiveContainer.vue';

const props = defineProps<{
  section: ExplainerDocSection;
  index: number;
}>();

const emit = defineEmits<{
  'module-interaction': [sectionId: string, action: string, value?: unknown];
}>();
</script>

<template>
  <section
    class="cpub-explainer-section"
    :class="index % 2 === 0 ? 'cpub-section-bg' : 'cpub-section-bg-alt'"
    :data-section-id="section.id"
  >
    <div class="cpub-explainer-section-inner">
      <!-- Section number badge -->
      <div class="cpub-section-number">{{ index + 1 }}</div>

      <!-- QUESTION: heading + body -->
      <h2 class="cpub-section-heading">{{ section.heading }}</h2>
      <div
        v-if="section.body"
        class="cpub-section-body"
        v-html="section.body"
      />

      <!-- INTERACT: module in dark container -->
      <InteractiveContainer
        v-if="section.module"
        :module="section.module"
      />

      <!-- INSIGHT: post-interaction discovery -->
      <div v-if="section.insight" class="cpub-section-insight">
        <i class="fa-solid fa-lightbulb" />
        <div>
          <strong>Insight:</strong> {{ section.insight }}
        </div>
      </div>

      <!-- ASIDE: optional callout -->
      <div v-if="section.aside" class="cpub-section-aside">
        <i v-if="section.aside.icon" :class="`fa-solid fa-${section.aside.icon}`" />
        <div>
          <strong v-if="section.aside.label">{{ section.aside.label }}:</strong>
          {{ section.aside.text }}
        </div>
      </div>

      <!-- BRIDGE: transition to next section -->
      <p
        v-if="section.bridge"
        class="cpub-section-bridge"
        v-html="section.bridge"
      />
    </div>
  </section>
</template>

<style scoped>
.cpub-explainer-section {
  position: relative;
}

.cpub-section-bg {
  background: var(--bg-section, #fafaf8);
}

.cpub-section-bg-alt {
  background: var(--bg-section-alt, #f2f0ec);
}

.cpub-explainer-section-inner {
  max-width: var(--section-max-width, 760px);
  margin: 0 auto;
  padding: var(--section-padding, 72px 32px);
}

/* Section number */
.cpub-section-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 700;
  background: var(--text-primary, #1a1a1a);
  color: var(--bg-section, #fafaf8);
  margin-bottom: 20px;
}

.cpub-section-bg-alt .cpub-section-number {
  color: var(--bg-section-alt, #f2f0ec);
}

/* Heading */
.cpub-section-heading {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.25;
  margin: 0 0 16px;
}

/* Body */
.cpub-section-body {
  font-family: var(--font-body);
  font-size: 17px;
  color: var(--text-secondary, #555);
  line-height: 1.7;
  margin-bottom: 4px;
}

.cpub-section-body :deep(strong) {
  color: var(--text-primary, #1a1a1a);
  font-weight: 600;
}

.cpub-section-body :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cpub-section-body :deep(code) {
  font-family: var(--font-ui);
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: var(--radius, 0px);
}

/* Insight */
.cpub-section-insight {
  background: var(--accent-light, rgba(224, 64, 48, 0.08));
  border-left: 3px solid var(--accent);
  padding: 16px 20px;
  margin: 24px 0;
  font-size: 15px;
  color: var(--text-secondary, #555);
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.cpub-section-insight i {
  color: var(--accent);
  margin-top: 3px;
  flex-shrink: 0;
}

.cpub-section-insight strong {
  color: var(--text-primary, #1a1a1a);
}

/* Aside */
.cpub-section-aside {
  background: rgba(0, 0, 0, 0.03);
  border-left: 3px solid var(--text-muted, #999);
  padding: 14px 18px;
  margin: 20px 0;
  font-size: 14px;
  color: var(--text-muted, #999);
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.cpub-section-aside i {
  margin-top: 2px;
  flex-shrink: 0;
}

.cpub-section-aside strong {
  color: var(--text-secondary, #555);
}

/* Bridge */
.cpub-section-bridge {
  font-family: var(--font-body);
  font-size: 17px;
  font-style: italic;
  color: var(--text-muted, #999);
  margin: 24px 0 0;
  line-height: 1.6;
}

.cpub-section-bridge :deep(strong) {
  color: var(--text-primary, #1a1a1a);
  font-style: normal;
}

@media (max-width: 768px) {
  .cpub-explainer-section-inner {
    padding: var(--section-padding-mobile, 48px 20px);
  }

  .cpub-section-heading {
    font-size: 22px;
  }

  .cpub-section-body {
    font-size: 15px;
  }
}
</style>
