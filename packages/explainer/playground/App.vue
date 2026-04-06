<script setup lang="ts">
import { ref, reactive } from 'vue';
import ScrollViewer from '../vue/components/viewer/ScrollViewer.vue';
import ExplainerSectionEditor from '../vue/components/editor-v2/ExplainerSectionEditor.vue';
import SliderBlock from '../vue/components/blocks/SliderBlock.vue';
import QuizBlock from '../vue/components/blocks/QuizBlock.vue';
import type { ExplainerDocument, ExplainerThemePreset } from '../src/types';
import '../vue/theme/explainer-themes.css';

const activeView = ref<'editor' | 'viewer' | 'components'>('editor');

// Sample ExplainerDocument — Feedback Loops explainer
const sampleDocument = reactive<ExplainerDocument>({
  version: 2,
  theme: 'dark-industrial',
  hero: {
    title: 'Feedback Loops',
    subtitle: 'A tiny push becomes an avalanche. A small correction keeps a rocket on course.',
    highlight: 'Why does everything spiral?',
    scrollHint: 'Scroll to find out',
  },
  sections: [
    {
      id: 'linear',
      anchor: 'linear-growth',
      heading: 'Start Simple: Linear Growth',
      body: '<p>Imagine you get paid <strong>$10 every day</strong>. After a week you have $70. After a month, $300. The growth is steady and predictable.</p><p>Drag the slider to change the daily amount and watch the total change proportionally.</p>',
      module: {
        type: 'slider',
        props: {
          label: '$/day', min: 1, max: 50, step: 1, unit: '', defaultValue: 10,
          feedback: [
            { min: 1, max: 15, state: 'low', message: 'Modest income. Straight line, no surprises.' },
            { min: 15, max: 35, state: 'good', message: 'Decent amount. Still perfectly linear.' },
            { min: 35, max: 50, state: 'high', message: 'Great rate! But still just a straight line.' },
          ],
        },
      },
      insight: 'In a linear system, the output does not affect the input. Every step adds the same amount.',
      bridge: '<em>Nothing weird here. <strong>But what happens when the output feeds back into the input?</strong></em>',
      aside: { icon: 'lightbulb', label: 'Key idea', text: 'Linear growth means every step adds the same amount. The graph is always a straight line.' },
    },
    {
      id: 'exponential',
      anchor: 'feed-it-back',
      heading: 'Now Feed It Back',
      body: '<p>What if instead of a flat $10/day, you earned <strong>a percentage of what you already have</strong>? Now the output feeds back into the input.</p>',
      module: {
        type: 'slider',
        props: {
          label: 'Growth %', min: 1, max: 30, step: 1, unit: '%', defaultValue: 5,
          feedback: [
            { min: 1, max: 8, state: 'low', message: 'Slow growth. The curve barely bends.' },
            { min: 8, max: 18, state: 'good', message: 'Now you can see it. The curve is bending upward.' },
            { min: 18, max: 30, state: 'high', message: 'Explosive! This is what exponential growth looks like.' },
          ],
        },
      },
      insight: 'This is exponential growth. The direct result of output feeding back into input.',
      bridge: '<em>Positive loops amplify. <strong>But not all feedback spirals out of control.</strong></em>',
      aside: { icon: 'globe', label: 'Real world', text: 'Compound interest, viral posts, early-stage epidemics.' },
    },
    {
      id: 'classification',
      anchor: 'the-other-kind',
      heading: 'The Other Kind: Correction',
      body: '<p>Not all feedback spirals out of control. <strong>Negative feedback loops</strong> push the system back toward a target.</p><p>Can you identify which type each real-world example is?</p>',
      module: {
        type: 'quiz',
        props: {
          question: 'A bank run (everyone withdraws because others are withdrawing) is which type of feedback loop?',
          options: [
            { text: 'Positive feedback (amplifying)', correct: true },
            { text: 'Negative feedback (stabilizing)', correct: false },
            { text: 'Neither', correct: false },
          ],
        },
      },
      insight: 'Positive loops amplify. Negative loops stabilize. Most real systems have both.',
      bridge: '<em>Real systems are never just one loop. <strong>They are a tug of war.</strong></em>',
    },
    {
      id: 'synthesis',
      anchor: 'putting-it-together',
      heading: 'Both at Once: The Tug of War',
      body: '<p>In a population, the birth rate creates a <strong>positive loop</strong>. But resources are finite — the <strong>negative loop</strong>.</p><p>The result? The S-curve. Positive feedback dominates early, then negative feedback takes over.</p>',
      insight: 'The S-curve is the signature of two competing feedback loops. Growth rate vs. carrying capacity.',
    },
  ],
  conclusion: {
    heading: 'So What?',
    body: '<p>Once you see feedback loops, you see them everywhere. Every system that <strong>grows</strong>, <strong>stabilizes</strong>, <strong>oscillates</strong>, or <strong>crashes</strong> is driven by feedback.</p><p>The next time something spirals, ask: what is feeding back into what?</p>',
  },
  meta: { estimatedMinutes: 12, difficulty: 'beginner' },
  settings: { showProgressBar: true, showNavDots: true, showFooter: true, footerText: 'An explorable explanation' },
});

function handleDocUpdate(doc: ExplainerDocument): void {
  Object.assign(sampleDocument, doc);
}
</script>

<template>
  <div class="playground">
    <!-- NAV -->
    <nav class="playground-nav">
      <div class="playground-title">@commonpub/explainer</div>
      <div class="playground-tabs">
        <button :class="{ active: activeView === 'editor' }" @click="activeView = 'editor'">Section Editor</button>
        <button :class="{ active: activeView === 'viewer' }" @click="activeView = 'viewer'">Scroll Viewer</button>
        <button :class="{ active: activeView === 'components' }" @click="activeView = 'components'">Components</button>
      </div>
    </nav>

    <!-- SECTION EDITOR -->
    <div v-if="activeView === 'editor'" style="height: calc(100vh - 48px);">
      <ExplainerSectionEditor
        :document="sampleDocument"
        @update:document="handleDocUpdate"
        @save="(doc: ExplainerDocument) => console.log('Save:', doc)"
      />
    </div>

    <!-- SCROLL VIEWER (full preview) -->
    <div v-else-if="activeView === 'viewer'" style="height: 100vh; overflow: auto;">
      <div style="position: fixed; top: 10px; left: 10px; z-index: 9999; display: flex; gap: 6px; align-items: center;">
        <label style="font-family: monospace; font-size: 11px; color: rgba(255,255,255,0.5);">Theme:</label>
        <select :value="sampleDocument.theme" @change="sampleDocument.theme = ($event.target as HTMLSelectElement).value as ExplainerThemePreset" style="font-family: monospace; font-size: 11px; background: #1a1a1a; color: #ccc; border: 1px solid #333; padding: 3px 8px;">
          <option value="dark-industrial">Dark Industrial</option>
          <option value="punk-zine">Punk Zine</option>
          <option value="paper-teal">Paper Teal</option>
          <option value="clean-light">Clean Light</option>
        </select>
        <button @click="activeView = 'editor'" style="font-family: monospace; font-size: 10px; background: #333; color: #ccc; border: 1px solid #555; padding: 3px 10px; cursor: pointer;">Back to Editor</button>
      </div>
      <ScrollViewer :document="sampleDocument" />
    </div>

    <!-- COMPONENT REFERENCE -->
    <div v-else class="playground-content">
      <h2 class="section-label">Interactive Module Components</h2>
      <p style="color: #999; font-size: 13px; margin-bottom: 20px;">These are the individual module viewers used inside sections. They receive config via the <code>content</code> prop.</p>

      <div class="block-section">
        <h3 class="section-label">Slider + Canvas</h3>
        <div style="background: #141418; border: 1px solid rgba(255,255,255,0.08); padding: 0;">
          <SliderBlock :content="{
            label: 'Growth Rate', min: 0, max: 100, step: 1, unit: '%', defaultValue: 30,
            feedback: [
              { min: 0, max: 30, state: 'low', message: 'Below average growth.' },
              { min: 30, max: 70, state: 'good', message: 'Healthy growth rate.' },
              { min: 70, max: 100, state: 'high', message: 'Aggressive — watch for burnout.' },
            ]
          }" />
        </div>
      </div>

      <div class="block-section">
        <h3 class="section-label">Knowledge Check (Quiz)</h3>
        <div style="background: #141418; border: 1px solid rgba(255,255,255,0.08); padding: 0;">
          <QuizBlock :content="{
            question: 'What type of feedback loop does a thermostat use?',
            options: [
              { text: 'Positive feedback', correct: false },
              { text: 'Negative feedback', correct: true },
              { text: 'No feedback', correct: false },
            ]
          }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.playground {
  font-family: var(--font-sans, system-ui, sans-serif);
  background: var(--bg, #fafaf9);
  min-height: 100vh;
}

[data-theme="dark"] .playground,
@media (prefers-color-scheme: dark) {
  .playground {
    background: var(--bg, #0f0f12);
  }
}

.playground-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  background: var(--surface, #fff);
  border-bottom: var(--border-width-default, 2px) solid var(--border, #1a1a1a);
}

.playground-title {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  font-weight: 700;
  color: var(--accent, #5b9cf6);
}

.playground-tabs {
  display: flex;
  gap: 4px;
}

.playground-tabs button {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 500;
  background: none;
  border: var(--border-width-default, 2px) solid transparent;
  color: var(--text-dim, #6b6b66);
  cursor: pointer;
}

.playground-tabs button:hover {
  color: var(--text, #1a1a1a);
}

.playground-tabs button.active {
  color: var(--accent, #5b9cf6);
  border-bottom-color: var(--accent, #5b9cf6);
}

.playground-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
}

.section-label {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint, #a3a39e);
  margin: 24px 0 12px;
}

.block-section {
  margin-bottom: 32px;
}
</style>
