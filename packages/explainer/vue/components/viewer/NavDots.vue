<script setup lang="ts">
import type { ExplainerDocSection } from '@commonpub/explainer';

defineProps<{
  sections: ExplainerDocSection[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  navigate: [sectionId: string];
}>();
</script>

<template>
  <nav class="cpub-explainer-dots" aria-label="Section navigation">
    <button
      v-for="(section, i) in sections"
      :key="section.id"
      class="cpub-explainer-dot"
      :class="{ 'cpub-explainer-dot-active': i === activeIndex }"
      :aria-label="`Section ${i + 1}: ${section.heading}`"
      :aria-current="i === activeIndex ? 'true' : undefined"
      @click="emit('navigate', section.id)"
    />
  </nav>
</template>

<style scoped>
.cpub-explainer-dots {
  position: fixed;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
}

.cpub-explainer-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 1.5px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.25s ease;
}

.cpub-explainer-dot:hover {
  background: rgba(255, 255, 255, 0.5);
}

.cpub-explainer-dot-active {
  background: var(--accent);
  border-color: var(--accent);
  transform: scale(1.6);
  box-shadow: 0 0 8px var(--accent-glow, rgba(224, 64, 48, 0.25));
}

@media (max-width: 768px) {
  .cpub-explainer-dots {
    display: none;
  }
}
</style>
