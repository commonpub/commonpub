<script setup lang="ts">
const props = defineProps<{
  content: any;
}>();

const sections = computed(() => props.content?.sections || [
  { title: 'Introduction', slug: 'introduction' },
  { title: 'Neurons & Signals', slug: 'neurons' },
  { title: 'Gradient Descent', slug: 'gradient-descent' },
  { title: 'Backpropagation', slug: 'backpropagation' },
  { title: 'Overfitting', slug: 'overfitting' },
  { title: 'Architectures', slug: 'architectures' },
  { title: 'Real-World Applications', slug: 'applications' },
]);

const activeSection = ref(2); // 0-indexed, default to section 3
const completedSections = ref<Set<number>>(new Set([0, 1]));
const bookmarked = ref(false);

const totalSections = computed(() => sections.value.length);
const progressPct = computed(() => ((activeSection.value + 1) / totalSections.value) * 100);

function goToSection(idx: number): void {
  if (idx >= 0 && idx < totalSections.value) {
    if (activeSection.value < idx) {
      completedSections.value.add(activeSection.value);
    }
    activeSection.value = idx;
  }
}

function prevSection(): void {
  if (activeSection.value > 0) activeSection.value--;
}

function nextSection(): void {
  completedSections.value.add(activeSection.value);
  if (activeSection.value < totalSections.value - 1) activeSection.value++;
}

// Interactive slider state
const learningRate = ref(10);
const lrValue = computed(() => (0.001 + (learningRate.value - 1) / 999 * 0.999).toFixed(3));
const lrPct = computed(() => ((learningRate.value - 1) / 999) * 100);
const lrState = computed(() => {
  const lr = parseFloat(lrValue.value);
  if (lr < 0.005) return 'slow';
  if (lr <= 0.3) return 'ok';
  return 'high';
});
const lrMessage = computed(() => {
  if (lrState.value === 'slow') return 'Too slow — barely converging. This will take forever to train.';
  if (lrState.value === 'ok') return 'Converging steadily. Loss decreasing each epoch.';
  return 'Too high — loss exploding! Overshooting the minimum on every step.';
});

// Quiz state
const quizAnswered = ref(false);
const quizCorrect = ref(false);
const checkpointVisible = ref(false);

function selectQuizOption(isCorrect: boolean): void {
  if (quizAnswered.value) return;
  quizAnswered.value = true;
  quizCorrect.value = isCorrect;
  setTimeout(() => { checkpointVisible.value = true; }, 600);
}
</script>

<template>
  <div class="cpub-explainer-view">
    <!-- PROGRESS BAR -->
    <div class="cpub-progress-line">
      <div class="cpub-progress-line-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- CUSTOM TOPBAR -->
    <header class="cpub-explainer-topbar">
      <div class="cpub-explainer-badge">EXPLAINER</div>
      <span class="cpub-topbar-title">{{ content.title }}</span>
      <div class="cpub-topbar-spacer"></div>
      <span class="cpub-progress-text">Section {{ activeSection + 1 }} of {{ totalSections }}</span>
      <div class="cpub-topbar-divider"></div>
      <div class="cpub-nav-btn-group">
        <button class="cpub-icon-btn" title="Previous section" @click="prevSection">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <button class="cpub-icon-btn" title="Next section" @click="nextSection">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
      <div class="cpub-topbar-divider"></div>
      <button class="cpub-icon-btn" :class="{ active: bookmarked }" title="Bookmark" @click="bookmarked = !bookmarked">
        <i :class="bookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"></i>
      </button>
      <button class="cpub-icon-btn" title="Share">
        <i class="fa-solid fa-arrow-up-from-bracket"></i>
      </button>
      <button class="cpub-icon-btn" title="Fullscreen">
        <i class="fa-solid fa-expand"></i>
      </button>
    </header>

    <!-- MAIN LAYOUT -->
    <div class="cpub-explainer-layout">
      <!-- SIDEBAR TOC -->
      <nav class="cpub-explainer-sidebar">
        <div class="cpub-toc-header">Contents</div>
        <ul class="cpub-toc-list">
          <li
            v-for="(section, i) in sections"
            :key="i"
            class="cpub-toc-item"
            :class="{ completed: completedSections.has(i), active: activeSection === i }"
          >
            <a @click="goToSection(i)">
              <span class="cpub-toc-icon">
                <i v-if="completedSections.has(i)" class="fa-solid fa-check"></i>
                <i v-else-if="activeSection === i" class="fa-solid fa-arrow-right"></i>
              </span>
              <span class="cpub-toc-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="cpub-toc-label">{{ section.title }}</span>
            </a>
          </li>
        </ul>
      </nav>

      <!-- MAIN CONTENT -->
      <main class="cpub-explainer-main">
        <div class="cpub-content-wrap">
          <!-- Section tag -->
          <div class="cpub-section-tag">§ {{ String(activeSection + 1).padStart(2, '0') }} · {{ sections[activeSection]?.title?.toUpperCase() }}</div>

          <!-- Section title -->
          <h1 class="cpub-section-title">{{ content.subtitle || sections[activeSection]?.title || content.title }}</h1>

          <!-- Body content -->
          <div class="cpub-body-text">
            <template v-if="content.content && Array.isArray(content.content) && content.content.length > 0">
              <ClientOnly>
                <CpubEditor :model-value="content.content" :editable="false" />
              </ClientOnly>
            </template>
            <template v-else>
              <p>A neural network learns by adjusting its weights to minimize a <em>loss function</em> — a measure of how wrong its predictions are. The algorithm that drives this process is called <strong>gradient descent</strong>.</p>
              <p>Think of it as rolling a ball down a hilly landscape toward the lowest valley. At each step, the ball moves in the direction of the steepest downward slope. The size of that step is controlled by a critical hyperparameter: the <em>learning rate</em>.</p>
            </template>
          </div>

          <!-- MATH BLOCK -->
          <div class="cpub-math-block">
            <span class="cpub-math-comment">// Weight update rule</span><br>
            w<sub>new</sub> &nbsp;=&nbsp; w<sub>old</sub> &nbsp;<span class="cpub-math-sym">−</span>&nbsp; <span class="cpub-math-sym">η</span> &nbsp;<span class="cpub-math-sym">·</span>&nbsp; ∂L/∂w
            <br><br>
            <span class="cpub-math-comment">// where ∂L/∂w is the gradient of the loss w.r.t. each weight</span>
          </div>

          <!-- INTERACTIVE SLIDER CARD -->
          <div class="cpub-interactive-card">
            <div class="cpub-card-header">
              <div class="cpub-card-header-icon"><i class="fa-solid fa-sliders"></i></div>
              <div class="cpub-card-header-label">Learning Rate <span>(η)</span></div>
            </div>
            <div class="cpub-slider-value-display">{{ lrValue }}</div>
            <div class="cpub-slider-track-wrap">
              <div class="cpub-slider-fill-track" :style="{ width: lrPct + '%' }"></div>
              <input type="range" v-model.number="learningRate" min="1" max="1000" step="1" class="cpub-slider-input" />
            </div>
            <div class="cpub-slider-range-labels">
              <span>0.001 — very slow</span>
              <span>1.0 — too high</span>
            </div>
            <div class="cpub-slider-output" :class="'state-' + lrState">
              <i :class="lrState === 'ok' ? 'fa-solid fa-circle-check' : lrState === 'slow' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-xmark'"></i>
              <span class="cpub-slider-output-text">{{ lrMessage }}</span>
            </div>
          </div>

          <!-- CALLOUT -->
          <div class="cpub-callout">
            <i class="fa-solid fa-lightbulb cpub-callout-icon"></i>
            <div class="cpub-callout-text">
              <strong>Practical tip:</strong> Use a learning rate finder — ramp the rate from a very small value over a short training run and plot the loss. The ideal rate sits just before the loss starts to rise sharply.
            </div>
          </div>

          <hr class="cpub-content-divider" />

          <!-- QUIZ BLOCK -->
          <div class="cpub-quiz-card">
            <div class="cpub-quiz-header">
              <span class="cpub-quiz-badge">QUICK CHECK</span>
              <span class="cpub-quiz-title-text">Test your understanding</span>
            </div>
            <div class="cpub-quiz-question">What happens when the learning rate is set too high?</div>
            <div class="cpub-quiz-options">
              <div
                class="cpub-quiz-option"
                :class="{ answered: quizAnswered, 'selected-wrong': quizAnswered && false }"
                @click="selectQuizOption(false)"
              >
                <span class="cpub-quiz-option-key">A</span>
                <span class="cpub-quiz-option-text">Training slows down because each weight update is tiny, requiring many more iterations to converge.</span>
                <i class="fa-solid fa-xmark cpub-quiz-option-indicator"></i>
              </div>
              <div
                class="cpub-quiz-option"
                :class="{ answered: quizAnswered, 'selected-correct': quizAnswered && quizCorrect, 'reveal-correct': quizAnswered && !quizCorrect }"
                @click="selectQuizOption(true)"
              >
                <span class="cpub-quiz-option-key">B</span>
                <span class="cpub-quiz-option-text">Updates overshoot the loss minimum — the model oscillates or diverges, and loss may increase instead of decrease.</span>
                <i class="fa-solid fa-check cpub-quiz-option-indicator"></i>
              </div>
              <div
                class="cpub-quiz-option"
                :class="{ answered: quizAnswered }"
                @click="selectQuizOption(false)"
              >
                <span class="cpub-quiz-option-key">C</span>
                <span class="cpub-quiz-option-text">The gradient becomes zero, stopping all learning permanently after the first few epochs.</span>
                <i class="fa-solid fa-xmark cpub-quiz-option-indicator"></i>
              </div>
              <div
                class="cpub-quiz-option"
                :class="{ answered: quizAnswered }"
                @click="selectQuizOption(false)"
              >
                <span class="cpub-quiz-option-key">D</span>
                <span class="cpub-quiz-option-text">Batch normalization layers automatically correct the rate, so there is no real effect on training.</span>
                <i class="fa-solid fa-xmark cpub-quiz-option-indicator"></i>
              </div>
            </div>
            <div v-if="quizAnswered" class="cpub-quiz-feedback" :class="quizCorrect ? 'correct' : 'wrong'">
              <i :class="quizCorrect ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'"></i>
              <span v-if="quizCorrect">Correct — a high learning rate causes overshooting and unstable training.</span>
              <span v-else>Not quite. The correct answer is <strong>B</strong> — overshooting leads to divergence.</span>
            </div>
          </div>

          <!-- CHECKPOINT -->
          <div class="cpub-checkpoint" :class="{ visible: checkpointVisible }">
            <i class="fa-solid fa-circle-check"></i>
            <span class="cpub-checkpoint-text">Section {{ activeSection + 1 }} complete</span>
            <span class="cpub-checkpoint-sub">+1 section · {{ totalSections - activeSection - 1 }} remaining</span>
          </div>

          <!-- SECTION NAV FOOTER -->
          <div class="cpub-section-nav">
            <button v-if="activeSection > 0" class="cpub-prev-btn" @click="prevSection">
              <i class="fa-solid fa-arrow-left"></i>
              {{ sections[activeSection - 1]?.title }}
            </button>
            <div v-else></div>

            <div class="cpub-progress-dots">
              <div
                v-for="(_, i) in totalSections"
                :key="i"
                class="cpub-dot"
                :class="{ done: completedSections.has(i), active: i === activeSection }"
              ></div>
            </div>

            <button v-if="activeSection < totalSections - 1" class="cpub-next-btn" @click="nextSection">
              Next: {{ sections[activeSection + 1]?.title }}
              <i class="fa-solid fa-arrow-right"></i>
            </button>
            <div v-else></div>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── PROGRESS BAR ── */
.cpub-progress-line {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--surface3);
  z-index: 200;
}

.cpub-progress-line-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.4s ease;
}

/* ── CUSTOM TOPBAR ── */
.cpub-explainer-topbar {
  position: fixed;
  top: 3px;
  left: 0;
  right: 0;
  height: 48px;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  z-index: 100;
}

.cpub-explainer-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  padding: 3px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cpub-topbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-topbar-spacer { flex: 1; }

.cpub-progress-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  flex-shrink: 0;
}

.cpub-topbar-divider {
  width: 2px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}

.cpub-icon-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
  flex-shrink: 0;
}

.cpub-icon-btn:hover {
  background: var(--surface2);
  color: var(--text);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-icon-btn:active {
  box-shadow: none;
  transform: translate(1px, 1px);
}

.cpub-icon-btn.active {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-nav-btn-group {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* ── LAYOUT ── */
.cpub-explainer-layout {
  display: flex;
  margin-top: 51px;
  height: calc(100vh - 51px);
  overflow: hidden;
}

/* ── SIDEBAR ── */
.cpub-explainer-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.cpub-toc-header {
  padding: 14px 14px 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  text-transform: uppercase;
  border-bottom: 2px solid var(--border);
}

.cpub-toc-list {
  list-style: none;
  padding: 6px 0;
}

.cpub-toc-item a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  text-decoration: none;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  cursor: pointer;
}

.cpub-toc-item a:hover {
  background: var(--surface2);
  color: var(--text);
}

.cpub-toc-item.completed a { color: var(--text-dim); }

.cpub-toc-item.active a {
  background: var(--accent-bg);
  border-left: 3px solid var(--accent);
  color: var(--accent);
  font-weight: 500;
}

.cpub-toc-icon {
  width: 14px;
  font-size: 10px;
  flex-shrink: 0;
  text-align: center;
}

.cpub-toc-item.completed .cpub-toc-icon { color: var(--green); }
.cpub-toc-item.active .cpub-toc-icon { color: var(--accent); }

.cpub-toc-num {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-toc-item.active .cpub-toc-num { color: var(--accent-border); }
.cpub-toc-item.completed .cpub-toc-num { color: var(--green-border); }

.cpub-toc-label {
  flex: 1;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── MAIN CONTENT ── */
.cpub-explainer-main {
  flex: 1;
  overflow-y: auto;
  background: var(--bg);
}

.cpub-content-wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 44px 36px 80px;
}

/* ── SECTION TAG ── */
.cpub-section-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cpub-section-tag::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 2px;
  background: var(--border);
}

/* ── SECTION TITLE ── */
.cpub-section-title {
  font-size: 30px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

/* ── BODY TEXT ── */
.cpub-body-text {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text);
  margin-bottom: 20px;
}

.cpub-body-text :deep(p) { margin-bottom: 14px; }
.cpub-body-text :deep(strong) { color: var(--text); font-weight: 700; }
.cpub-body-text :deep(em) { color: var(--accent); font-style: normal; font-weight: 500; }
.cpub-body-text :deep(code) {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--surface2);
  border: 2px solid var(--border);
  padding: 1px 6px;
  color: var(--accent);
}

/* ── MATH BLOCK ── */
.cpub-math-block {
  font-family: var(--font-mono);
  font-size: 14px;
  background: var(--border);
  color: var(--border2);
  border: 2px solid var(--border);
  padding: 16px 18px;
  margin: 16px 0;
  line-height: 1.7;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-math-sym { color: var(--accent); }
.cpub-math-comment { color: var(--text-dim); }

/* ── INTERACTIVE SLIDER CARD ── */
.cpub-interactive-card {
  background: var(--surface);
  border: 2px solid var(--border);
  border-left: 4px solid var(--accent);
  padding: 22px 24px;
  margin: 28px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.cpub-card-header-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  color: var(--accent);
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-card-header-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.cpub-card-header-label span {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  margin-left: 4px;
}

.cpub-slider-value-display {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 14px;
  letter-spacing: 0.04em;
}

.cpub-slider-track-wrap {
  position: relative;
  margin-bottom: 10px;
}

.cpub-slider-fill-track {
  position: absolute;
  top: 50%;
  left: 0;
  height: 6px;
  background: var(--accent);
  transform: translateY(-50%);
  pointer-events: none;
  transition: width 0.05s;
}

.cpub-slider-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--surface3);
  border: 2px solid var(--border);
  outline: none;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.cpub-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-slider-range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.cpub-slider-range-labels span {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-slider-output {
  margin-top: 16px;
  padding: 12px 14px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  min-height: 42px;
}

.cpub-slider-output.state-slow {
  background: var(--yellow-bg);
  border: 2px solid var(--yellow-border);
  color: var(--yellow);
}

.cpub-slider-output.state-ok {
  background: var(--green-bg);
  border: 2px solid var(--green-border);
  color: var(--green);
}

.cpub-slider-output.state-high {
  background: var(--red-bg);
  border: 2px solid var(--red-border);
  color: var(--red);
}

.cpub-slider-output i { font-size: 13px; flex-shrink: 0; }
.cpub-slider-output-text { line-height: 1.4; }

/* ── CALLOUT ── */
.cpub-callout {
  display: flex;
  gap: 12px;
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 16px 18px;
  margin: 20px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-callout-icon {
  font-size: 14px;
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}

.cpub-callout-text {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-dim);
}

.cpub-callout-text strong { color: var(--text); }

/* ── DIVIDER ── */
.cpub-content-divider {
  border: none;
  border-top: 2px solid var(--border);
  margin: 36px 0;
}

/* ── QUIZ ── */
.cpub-quiz-card {
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 22px 24px;
  margin: 28px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-quiz-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 2px solid var(--border);
}

.cpub-quiz-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--yellow);
  background: var(--yellow-bg);
  border: 2px solid var(--yellow-border);
  padding: 3px 8px;
}

.cpub-quiz-title-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.cpub-quiz-question {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.5;
  margin-bottom: 16px;
}

.cpub-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-quiz-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--surface);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
  user-select: none;
}

.cpub-quiz-option:hover:not(.answered) {
  background: var(--surface2);
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-quiz-option.selected-correct {
  background: var(--green-bg);
  border-color: var(--green);
  cursor: default;
}

.cpub-quiz-option.selected-wrong {
  background: var(--red-bg);
  border-color: var(--red);
  cursor: default;
}

.cpub-quiz-option.reveal-correct {
  background: var(--green-bg);
  border-color: var(--green-border);
  cursor: default;
}

.cpub-quiz-option.answered { cursor: default; box-shadow: none; }

.cpub-quiz-option-key {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
  width: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-key { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-key { color: var(--red); }
.cpub-quiz-option.reveal-correct .cpub-quiz-option-key { color: var(--green); }

.cpub-quiz-option-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-dim);
  flex: 1;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-text { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-text { color: var(--red); }

.cpub-quiz-option-indicator {
  font-size: 12px;
  margin-top: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-indicator,
.cpub-quiz-option.selected-wrong .cpub-quiz-option-indicator,
.cpub-quiz-option.reveal-correct .cpub-quiz-option-indicator {
  opacity: 1;
}

.cpub-quiz-option.selected-correct .cpub-quiz-option-indicator { color: var(--green); }
.cpub-quiz-option.selected-wrong .cpub-quiz-option-indicator { color: var(--red); }
.cpub-quiz-option.reveal-correct .cpub-quiz-option-indicator { color: var(--green); }

.cpub-quiz-feedback {
  margin-top: 14px;
  padding: 10px 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-quiz-feedback.correct {
  background: var(--green-bg);
  border: 2px solid var(--green-border);
  color: var(--green);
}

.cpub-quiz-feedback.wrong {
  background: var(--red-bg);
  border: 2px solid var(--red-border);
  color: var(--red);
}

/* ── CHECKPOINT ── */
.cpub-checkpoint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--green-bg);
  border: 2px solid var(--green);
  margin-top: 24px;
  font-size: 13px;
  color: var(--green);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.cpub-checkpoint.visible {
  opacity: 1;
  transform: translateY(0);
}

.cpub-checkpoint i { font-size: 14px; }
.cpub-checkpoint-text { font-weight: 600; }

.cpub-checkpoint-sub {
  margin-left: auto;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--green-border);
}

/* ── SECTION NAV FOOTER ── */
.cpub-section-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 2px solid var(--border);
}

.cpub-progress-dots {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border2);
  transition: background 0.15s, transform 0.15s;
}

.cpub-dot.done { background: var(--green); }
.cpub-dot.active {
  background: var(--accent);
  transform: scale(1.3);
}

.cpub-next-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  color: var(--color-text-inverse);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  box-shadow: 4px 4px 0 var(--border);
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}

.cpub-next-btn:hover {
  box-shadow: 2px 2px 0 var(--border);
  transform: translate(1px, 1px);
}

.cpub-next-btn i { font-size: 12px; }

.cpub-prev-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--surface);
  border: 2px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: box-shadow var(--transition-fast);
}

.cpub-prev-btn:hover {
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-prev-btn i { font-size: 12px; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .cpub-explainer-sidebar { display: none; }
  .cpub-explainer-layout { margin-top: 51px; }
  .cpub-content-wrap { padding: 24px 16px 48px; }
  .cpub-section-nav { flex-direction: column; gap: 16px; }
}
</style>
