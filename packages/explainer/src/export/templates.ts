/** CSS template with custom property fallbacks for standalone HTML */
export function generateCss(theme: string): string {
  const themeVars: Record<string, Record<string, string>> = {
    base: {
      '--color-bg': '#ffffff',
      '--color-text': '#1a1a2e',
      '--color-heading': '#16213e',
      '--color-primary': '#0f3460',
      '--color-primary-light': '#e8eef6',
      '--color-accent': '#e94560',
      '--color-border': '#e0e0e0',
      '--color-surface': '#f8f9fa',
      '--color-success': '#2e7d32',
      '--color-error': '#c62828',
      '--color-warning': '#f57f17',
      '--font-body': 'system-ui, -apple-system, sans-serif',
      '--font-heading': 'system-ui, -apple-system, sans-serif',
      '--font-mono': 'ui-monospace, "Cascadia Code", monospace',
      '--radius-sm': '4px',
      '--radius-md': '8px',
      '--space-xs': '4px',
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
    },
    dark: {
      '--color-bg': '#111111',
      '--color-text': '#e5e5e3',
      '--color-heading': '#e5e5e3',
      '--color-primary': '#5b9cf6',
      '--color-primary-light': '#1a1a1a',
      '--color-accent': '#5b9cf6',
      '--color-border': '#444440',
      '--color-surface': '#1a1a1a',
      '--color-success': '#34d399',
      '--color-error': '#f87171',
      '--color-warning': '#fbbf24',
      '--font-body': 'system-ui, -apple-system, sans-serif',
      '--font-heading': 'system-ui, -apple-system, sans-serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace',
      '--radius-sm': '0',
      '--radius-md': '0',
      '--space-xs': '4px',
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
    },
    generics: {
      '--color-bg': '#0c0c0b',
      '--color-text': '#d8d5cf',
      '--color-heading': '#d8d5cf',
      '--color-primary': '#5b9cf6',
      '--color-primary-light': '#141413',
      '--color-accent': '#5b9cf6',
      '--color-border': '#272725',
      '--color-surface': '#141413',
      '--color-success': '#4ade80',
      '--color-error': '#f87171',
      '--color-warning': '#fbbf24',
      '--font-body': 'system-ui, -apple-system, sans-serif',
      '--font-heading': 'system-ui, -apple-system, sans-serif',
      '--font-mono': 'ui-monospace, monospace',
      '--radius-sm': '4px',
      '--radius-md': '4px',
      '--space-xs': '4px',
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
    },
    agora: {
      '--color-bg': '#f7f4ed',
      '--color-text': '#1a1a1a',
      '--color-heading': '#1a1a1a',
      '--color-primary': '#3d8b5e',
      '--color-primary-light': '#ece8de',
      '--color-accent': '#3d8b5e',
      '--color-border': '#1a1a1a',
      '--color-surface': '#faf8f3',
      '--color-success': '#3d8b5e',
      '--color-error': '#c4443a',
      '--color-warning': '#c4882a',
      '--font-body': '"Work Sans", system-ui, sans-serif',
      '--font-heading': '"Fraunces", Georgia, serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace',
      '--radius-sm': '0',
      '--radius-md': '0',
      '--space-xs': '4px',
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
    },
    'agora-dark': {
      '--color-bg': '#0d1a12',
      '--color-text': '#e8e8e2',
      '--color-heading': '#e8e8e2',
      '--color-primary': '#4aa06e',
      '--color-primary-light': '#141f17',
      '--color-accent': '#4aa06e',
      '--color-border': '#3a4f40',
      '--color-surface': '#141f17',
      '--color-success': '#4aa06e',
      '--color-error': '#d85e55',
      '--color-warning': '#daa040',
      '--font-body': '"Work Sans", system-ui, sans-serif',
      '--font-heading': '"Fraunces", Georgia, serif',
      '--font-mono': '"JetBrains Mono", ui-monospace, monospace',
      '--radius-sm': '0',
      '--radius-md': '0',
      '--space-xs': '4px',
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
    },
  };

  const vars = themeVars[theme] ?? themeVars.base;
  const rootVars = Object.entries(vars!)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  return `
:root {
${rootVars}
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
}

.explainer-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.explainer-toc {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: var(--space-lg);
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.explainer-toc__title {
  font-family: var(--font-heading);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-heading);
  margin-bottom: var(--space-md);
}

.explainer-toc__list {
  list-style: none;
}

.explainer-toc__item {
  margin-bottom: var(--space-xs);
}

.explainer-toc__link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.15s;
}

.explainer-toc__link:hover { background: var(--color-primary-light); }
.explainer-toc__link--active { background: var(--color-primary-light); font-weight: 600; }
.explainer-toc__link--locked { opacity: 0.5; pointer-events: none; }
.explainer-toc__link--completed::before { content: "\\2713"; color: var(--color-success); }

.explainer-content {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-xl);
}

.explainer-header {
  margin-bottom: var(--space-xl);
}

.explainer-header__title {
  font-family: var(--font-heading);
  font-size: 2rem;
  color: var(--color-heading);
  margin-bottom: var(--space-sm);
}

.explainer-header__meta {
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.875rem;
}

.explainer-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-border);
  z-index: 100;
}

.explainer-progress-bar__fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.explainer-section {
  margin-bottom: var(--space-xl);
  padding-bottom: var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.explainer-section__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: var(--color-heading);
  margin-bottom: var(--space-md);
}

.explainer-section__content { margin-bottom: var(--space-md); }

.block-text { margin-bottom: var(--space-md); }
.block-heading { color: var(--color-heading); margin: var(--space-lg) 0 var(--space-sm); }
.block-code {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.875rem;
}
.code-filename {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
  opacity: 0.7;
  margin-bottom: var(--space-xs);
}
.block-image { margin: var(--space-md) 0; }
.block-image img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
.block-image figcaption { font-size: 0.875rem; opacity: 0.7; margin-top: var(--space-xs); text-align: center; }
.block-quote {
  border-left: 3px solid var(--color-primary);
  padding-left: var(--space-md);
  margin: var(--space-md) 0;
  font-style: italic;
}
.block-quote footer { font-style: normal; opacity: 0.7; margin-top: var(--space-xs); }
.block-callout {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  margin: var(--space-md) 0;
  border-left: 4px solid var(--color-primary);
  background: var(--color-primary-light);
}
.block-callout--warning { border-left-color: var(--color-warning); }
.block-callout--danger { border-left-color: var(--color-error); }

.quiz-form { margin-top: var(--space-md); }
.quiz-question {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
}
.quiz-question__text {
  font-weight: 600;
  margin-bottom: var(--space-sm);
}
.quiz-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  cursor: pointer;
}
.quiz-option input[type="radio"] { accent-color: var(--color-primary); }
.quiz-submit {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
}
.quiz-submit:hover { opacity: 0.9; }
.quiz-submit:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.quiz-result { margin-top: var(--space-md); padding: var(--space-md); border-radius: var(--radius-md); }
.quiz-result--passed { background: var(--color-success); color: white; }
.quiz-result--failed { background: var(--color-error); color: white; }
.quiz-question__feedback--correct { color: var(--color-success); }
.quiz-question__feedback--incorrect { color: var(--color-error); }

.checkpoint {
  text-align: center;
  padding: var(--space-xl);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
}
.checkpoint__continue {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  cursor: pointer;
  margin-top: var(--space-md);
}
.checkpoint__continue:disabled { opacity: 0.5; cursor: not-allowed; }

.controls-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
}
.control label { font-weight: 500; }
.control input[type="range"] { width: 100%; }
.control select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.explainer-nav {
  display: flex;
  justify-content: space-between;
  padding: var(--space-lg) 0;
  margin-top: var(--space-xl);
  border-top: 1px solid var(--color-border);
}
.explainer-nav__btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text);
}
.explainer-nav__btn:hover { background: var(--color-primary-light); }
.explainer-nav__btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 768px) {
  .explainer-layout { grid-template-columns: 1fr; }
  .explainer-toc { display: none; }
}
`;
}

/** Inline JavaScript for quiz interactivity, progress, and navigation */
export function generateJs(sectionCount: number): string {
  return `
(function() {
  'use strict';

  var STORAGE_KEY = 'explainer-progress-' + document.title.replace(/\\s+/g, '-').toLowerCase();
  var sections = document.querySelectorAll('.explainer-section');
  var progressFill = document.querySelector('.explainer-progress-bar__fill');
  var tocLinks = document.querySelectorAll('.explainer-toc__link');

  function loadProgress() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
  }

  function saveProgress(progress) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  function updateProgressBar(progress) {
    var total = ${sectionCount};
    var completed = Object.keys(progress).filter(function(k) { return progress[k]; }).length;
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (progressFill) progressFill.style.width = pct + '%';
  }

  function updateToc(progress) {
    tocLinks.forEach(function(link) {
      var id = link.getAttribute('href').replace('#', '');
      if (progress[id]) {
        link.classList.add('explainer-toc__link--completed');
      }
    });
  }

  function markComplete(sectionId) {
    var progress = loadProgress();
    progress[sectionId] = true;
    saveProgress(progress);
    updateProgressBar(progress);
    updateToc(progress);
  }

  // Quiz handling
  document.querySelectorAll('.quiz-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var sectionId = form.dataset.sectionId;
      var questions = form.querySelectorAll('.quiz-question');
      var total = questions.length;
      var correct = 0;

      questions.forEach(function(q) {
        var qId = q.dataset.questionId;
        var selected = form.querySelector('input[name="q-' + qId + '"]:checked');
        var feedback = q.querySelector('.quiz-question__feedback');

        if (!selected) return;

        var isCorrect = selected.dataset && selected.value === q.dataset.correctId;
        if (feedback) {
          feedback.hidden = false;
          feedback.textContent = isCorrect ? 'Correct!' : 'Incorrect';
          feedback.className = 'quiz-question__feedback quiz-question__feedback--' + (isCorrect ? 'correct' : 'incorrect');
        }
        if (isCorrect) correct++;
      });

      var score = total > 0 ? Math.round((correct / total) * 100) : 0;
      var resultEl = form.querySelector('.quiz-result');
      var passingScore = parseInt(form.dataset.passingScore || '70', 10);
      var passed = score >= passingScore;

      if (resultEl) {
        resultEl.hidden = false;
        resultEl.className = 'quiz-result quiz-result--' + (passed ? 'passed' : 'failed');
        resultEl.textContent = 'Score: ' + score + '% (' + correct + '/' + total + ') - ' + (passed ? 'Passed!' : 'Try again');
      }

      if (passed) markComplete(sectionId);
    });
  });

  // Checkpoint handling
  document.querySelectorAll('.checkpoint__continue').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sectionId = btn.closest('.checkpoint').dataset.sectionId;
      markComplete(sectionId);
      btn.textContent = 'Completed';
      btn.disabled = true;
    });
  });

  // Scroll-based text section completion
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var section = entry.target;
        var sectionId = section.dataset.sectionId;
        if (section.classList.contains('explainer-section--text')) {
          markComplete(sectionId);
        }
      }
    });
  }, { threshold: 0.7 });

  sections.forEach(function(s) { observer.observe(s); });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    var current = -1;
    sections.forEach(function(s, i) {
      var rect = s.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight / 2 && current === -1) current = i;
    });

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (current < sections.length - 1) sections[current + 1].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (current > 0) sections[current - 1].scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Slider output sync
  document.querySelectorAll('.control--slider input[type="range"]').forEach(function(slider) {
    var output = slider.parentElement.querySelector('output');
    if (output) slider.addEventListener('input', function() { output.textContent = slider.value; });
  });

  // Initialize
  var progress = loadProgress();
  updateProgressBar(progress);
  updateToc(progress);
})();
`;
}
