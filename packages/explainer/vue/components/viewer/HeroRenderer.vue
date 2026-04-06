<script setup lang="ts">
import type { ExplainerHero } from '@commonpub/explainer';

defineProps<{
  hero: ExplainerHero;
}>();
</script>

<template>
  <section class="cpub-explainer-hero" data-section-id="hero">
    <div class="cpub-explainer-hero-inner">
      <h1 class="cpub-explainer-hero-title">{{ hero.title }}</h1>

      <p v-if="hero.subtitle" class="cpub-explainer-hero-subtitle">
        {{ hero.subtitle }}
        <span v-if="hero.highlight" class="cpub-explainer-hero-highlight">{{ hero.highlight }}</span>
      </p>

      <div class="cpub-explainer-hero-scroll-hint">
        <span>{{ hero.scrollHint || 'Scroll to begin' }}</span>
        <i class="fa-solid fa-chevron-down" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-explainer-hero {
  background: var(--bg-page);
  color: var(--text-on-dark, #fff);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.cpub-explainer-hero-inner {
  max-width: var(--section-max-width, 760px);
  text-align: center;
  padding: 100px 32px 80px;
}

.cpub-explainer-hero-title {
  font-family: var(--font-display);
  font-size: 42px;
  font-weight: 700;
  color: var(--text-on-dark, #fff);
  line-height: 1.15;
  margin: 0 0 24px;
}

.cpub-explainer-hero-subtitle {
  font-family: var(--font-body);
  font-size: 19px;
  color: var(--text-on-dark-dim, rgba(255, 255, 255, 0.55));
  line-height: 1.6;
  max-width: 560px;
  margin: 0 auto 32px;
}

.cpub-explainer-hero-highlight {
  color: var(--text-on-dark, #fff);
  background: var(--accent-light);
  border-bottom: 2px solid var(--accent);
  padding: 1px 6px;
}

.cpub-explainer-hero-scroll-hint {
  font-family: var(--font-ui);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-on-dark-faint, rgba(255, 255, 255, 0.2));
  margin-top: 48px;
  animation: cpub-float 2.5s ease-in-out infinite;
}

.cpub-explainer-hero-scroll-hint i {
  display: block;
  margin-top: 8px;
  color: var(--accent);
  font-size: 14px;
}

@keyframes cpub-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(7px); }
}

@media (max-width: 768px) {
  .cpub-explainer-hero-inner {
    padding: 60px 20px 48px;
  }

  .cpub-explainer-hero-title {
    font-size: 28px;
  }

  .cpub-explainer-hero-subtitle {
    font-size: 16px;
  }
}
</style>
