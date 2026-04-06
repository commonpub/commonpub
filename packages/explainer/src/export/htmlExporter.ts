import type { ExplainerSection, ExplainerDocument, ExplainerDocSection, ExportOptions } from '../types.js';
import { isExplainerDocument } from '../types.js';
import { renderSection } from '../render/sectionRenderer.js';
import { generateCss, generateJs } from './templates.js';
import { minifyCss, minifyJs, wrapStyle, wrapScript } from './inlineAssets.js';

/**
 * Generate a self-contained HTML document from explainer content.
 * Accepts either the legacy ExplainerSection[] or the new ExplainerDocument format.
 */
export function generateExplainerHtml(
  content: ExplainerSection[] | ExplainerDocument,
  options: ExportOptions,
): string {
  if (isExplainerDocument(content)) {
    return generateDocumentHtml(content, options);
  }
  return generateLegacyHtml(content, options);
}

// ─── Legacy format (ExplainerSection[]) ────────────────────────────

function generateLegacyHtml(
  sections: ExplainerSection[],
  options: ExportOptions,
): string {
  const css = generateCss(options.theme);
  const js = generateJs(sections.length);

  const sectionsHtml = sections.map((s) => renderSection(s)).join('\n');

  const tocHtml = sections
    .map(
      (s) =>
        `<li class="explainer-toc__item"><a class="explainer-toc__link" href="#${escapeAttr(s.anchor)}">${escapeHtml(s.title)}</a></li>`,
    )
    .join('\n');

  const metaDescription = options.description
    ? `<meta name="description" content="${escapeAttr(options.description)}" />`
    : '';

  const authorMeta = options.author
    ? `<meta name="author" content="${escapeAttr(options.author)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
  ${metaDescription}
  ${authorMeta}
  ${wrapStyle(minifyCss(css))}
</head>
<body>
  <div class="explainer-progress-bar" role="progressbar" aria-label="Reading progress">
    <div class="explainer-progress-bar__fill" style="width: 0%"></div>
  </div>
  <div class="explainer-layout">
    <nav class="explainer-toc" aria-label="Table of contents">
      <h2 class="explainer-toc__title">Contents</h2>
      <ol class="explainer-toc__list">
        ${tocHtml}
      </ol>
    </nav>
    <main class="explainer-content">
      <header class="explainer-header">
        <h1 class="explainer-header__title">${escapeHtml(options.title)}</h1>
        ${options.description ? `<p class="explainer-header__meta">${escapeHtml(options.description)}</p>` : ''}
      </header>
      ${sectionsHtml}
      <nav class="explainer-nav" aria-label="Section navigation">
        <button class="explainer-nav__btn" id="nav-prev" disabled>Previous</button>
        <button class="explainer-nav__btn" id="nav-next">Next</button>
      </nav>
    </main>
  </div>
  ${wrapScript(minifyJs(js))}
</body>
</html>`;
}

// ─── ExplainerDocument format (scroll viewer) ──────────────────────

function generateDocumentHtml(
  doc: ExplainerDocument,
  options: ExportOptions,
): string {
  const title = doc.hero.title || options.title;
  const description = doc.meta.description || options.description;
  const themePreset = typeof doc.theme === 'string' ? doc.theme : doc.theme.preset;
  const css = generateDocumentCss(options.theme, themePreset);
  const js = generateDocumentJs(doc.sections.length);

  const heroHtml = renderHero(doc.hero);
  const sectionsHtml = doc.sections.map((s) => renderDocSection(s)).join('\n');
  const conclusionHtml = doc.conclusion ? renderConclusion(doc.conclusion) : '';

  const navDotsHtml = doc.sections
    .map(
      (s, i) =>
        `<button class="explainer-nav-dot" data-section="${i}" aria-label="${escapeAttr(s.heading)}" title="${escapeAttr(s.heading)}"></button>`,
    )
    .join('\n');

  const metaDescription = description
    ? `<meta name="description" content="${escapeAttr(description)}" />`
    : '';

  const authorMeta = options.author
    ? `<meta name="author" content="${escapeAttr(options.author)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${metaDescription}
  ${authorMeta}
  ${wrapStyle(minifyCss(css))}
</head>
<body>
  <div class="explainer-progress-bar" role="progressbar" aria-label="Reading progress">
    <div class="explainer-progress-bar__fill" style="width: 0%"></div>
  </div>
  <nav class="explainer-nav-dots" aria-label="Section navigation">
    ${navDotsHtml}
  </nav>
  <main class="explainer-scroll-content">
    ${heroHtml}
    ${sectionsHtml}
    ${conclusionHtml}
  </main>
  ${doc.settings?.footerText ? `<footer class="explainer-footer"><p>${escapeHtml(doc.settings.footerText)}</p></footer>` : ''}
  ${wrapScript(minifyJs(js))}
</body>
</html>`;
}

function renderHero(hero: ExplainerDocument['hero']): string {
  const subtitle = hero.subtitle
    ? `<p class="explainer-hero__subtitle">${hero.highlight ? highlightText(hero.subtitle, hero.highlight) : escapeHtml(hero.subtitle)}</p>`
    : '';
  const scrollHint = hero.scrollHint
    ? `<p class="explainer-hero__scroll-hint">${escapeHtml(hero.scrollHint)}</p>`
    : '';
  const bgStyle = hero.coverImageUrl
    ? ` style="background-image: url('${escapeAttr(hero.coverImageUrl)}')"`
    : '';

  return `
  <section class="explainer-hero"${bgStyle} aria-label="Introduction">
    <h1 class="explainer-hero__title">${escapeHtml(hero.title)}</h1>
    ${subtitle}
    ${scrollHint}
  </section>`;
}

function renderDocSection(section: ExplainerDocSection): string {
  const bodyHtml = sanitizeRichHtml(section.body);
  const moduleHtml = section.module
    ? `<div class="explainer-interact" data-module-type="${escapeAttr(section.module.type)}" aria-label="Interactive element">${renderModulePlaceholder(section.module.type, section.module.props)}</div>`
    : '';
  const insightHtml = section.insight
    ? `<div class="explainer-insight" role="note"><p>${escapeHtml(section.insight)}</p></div>`
    : '';
  const bridgeHtml = section.bridge
    ? `<div class="explainer-bridge">${sanitizeRichHtml(section.bridge)}</div>`
    : '';
  const asideHtml = section.aside
    ? `<aside class="explainer-aside"><span class="explainer-aside__icon" aria-hidden="true">${escapeHtml(section.aside.icon)}</span><strong>${escapeHtml(section.aside.label)}</strong> ${escapeHtml(section.aside.text)}</aside>`
    : '';

  return `
  <section id="${escapeAttr(section.anchor)}" class="explainer-doc-section" data-section-id="${escapeAttr(section.id)}">
    <h2 class="explainer-doc-section__heading">${escapeHtml(section.heading)}</h2>
    <div class="explainer-doc-section__body">${bodyHtml}</div>
    ${moduleHtml}
    ${insightHtml}
    ${bridgeHtml}
    ${asideHtml}
  </section>`;
}

function renderConclusion(conclusion: ExplainerDocument['conclusion'] & object): string {
  const ctaHtml = conclusion.callToAction
    ? `<a class="explainer-conclusion__cta" href="${escapeAttr(conclusion.callToAction.url)}">${escapeHtml(conclusion.callToAction.label)}</a>`
    : '';

  return `
  <section class="explainer-conclusion" aria-label="Conclusion">
    <h2 class="explainer-conclusion__heading">${escapeHtml(conclusion.heading)}</h2>
    <div class="explainer-conclusion__body">${sanitizeRichHtml(conclusion.body)}</div>
    ${ctaHtml}
  </section>`;
}

/** Render a static placeholder for interactive modules in exported HTML */
function renderModulePlaceholder(type: string, props: Record<string, unknown>): string {
  switch (type) {
    case 'slider': {
      const label = String(props.label || 'Slider');
      const min = Number(props.min ?? 0);
      const max = Number(props.max ?? 100);
      const step = Number(props.step ?? 1);
      const defaultValue = Number(props.defaultValue ?? 50);
      return `
        <div class="module-slider">
          <label>${escapeHtml(label)}</label>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${defaultValue}" />
          <output>${defaultValue}</output>
        </div>`;
    }
    case 'quiz': {
      const question = String(props.question || '');
      const options = (props.options as Array<{ text: string; correct?: boolean }>) || [];
      return `
        <div class="module-quiz">
          <p class="module-quiz__question">${escapeHtml(question)}</p>
          <div class="module-quiz__options" role="radiogroup">
            ${options.map((opt, i) => `<label class="module-quiz__option"><input type="radio" name="quiz-${type}" value="${i}" /> ${escapeHtml(opt.text)}</label>`).join('\n')}
          </div>
        </div>`;
    }
    case 'toggle': {
      const labelA = String(props.labelA || 'Option A');
      const labelB = String(props.labelB || 'Option B');
      return `
        <div class="module-toggle">
          <button class="module-toggle__btn module-toggle__btn--active">${escapeHtml(labelA)}</button>
          <button class="module-toggle__btn">${escapeHtml(labelB)}</button>
        </div>`;
    }
    case 'reveal-cards': {
      const items = (props.items as Array<{ front: string }>) || [];
      return `
        <div class="module-cards">
          ${items.map((item) => `<div class="module-cards__card">${escapeHtml(item.front)}</div>`).join('\n')}
        </div>`;
    }
    default:
      return `<div class="module-placeholder">[Interactive: ${escapeHtml(type)}]</div>`;
  }
}

function highlightText(text: string, highlight: string): string {
  const idx = text.indexOf(highlight);
  if (idx === -1) return escapeHtml(text);
  const before = text.slice(0, idx);
  const after = text.slice(idx + highlight.length);
  return `${escapeHtml(before)}<span class="explainer-highlight">${escapeHtml(highlight)}</span>${escapeHtml(after)}`;
}

// ─── Shared utilities ───────────────────��──────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Sanitize rich-text HTML — strip scripts, event handlers, javascript: URLs */
function sanitizeRichHtml(html: string): string {
  let sanitized = html.replace(/<script[\s>][\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  return sanitized;
}

// ─── Document-format CSS ───────────────────────────────────────────

/** Explainer theme presets — CSS custom properties for each preset */
const EXPLAINER_THEME_VARS: Record<string, Record<string, string>> = {
  'dark-industrial': {
    '--bg-page': '#0c0c0f', '--bg-section': '#fafaf8', '--bg-section-alt': '#f2f0ec', '--bg-dark': '#141418',
    '--text-primary': '#1a1a1a', '--text-secondary': '#555', '--text-muted': '#999',
    '--text-on-dark': 'rgba(255,255,255,0.85)', '--text-on-dark-dim': 'rgba(255,255,255,0.45)',
    '--accent': '#e04030', '--accent-hover': '#c83628', '--accent-light': 'rgba(224,64,48,0.08)',
    '--border': 'rgba(0,0,0,0.1)', '--border-dark': 'rgba(255,255,255,0.08)', '--border-width': '0px',
    '--font-display': "'Space Grotesk', system-ui, sans-serif",
    '--font-body': "'Space Grotesk', system-ui, sans-serif",
    '--font-ui': "'JetBrains Mono', ui-monospace, monospace",
    '--radius': '0px',
  },
  'punk-zine': {
    '--bg-page': '#1a1a1a', '--bg-section': '#f5f0e8', '--bg-section-alt': '#ebe5d9', '--bg-dark': '#111114',
    '--text-primary': '#1a1a1a', '--text-secondary': '#444', '--text-muted': '#888',
    '--text-on-dark': 'rgba(255,255,255,0.9)', '--text-on-dark-dim': 'rgba(255,255,255,0.5)',
    '--accent': '#ff3366', '--accent-hover': '#e6294f', '--accent-light': 'rgba(255,51,102,0.1)',
    '--border': 'rgba(0,0,0,0.15)', '--border-dark': 'rgba(255,255,255,0.1)', '--border-width': '2px',
    '--font-display': "'Permanent Marker', cursive",
    '--font-body': "'Special Elite', 'Courier New', monospace",
    '--font-ui': "'VT323', 'Courier New', monospace",
    '--radius': '0px',
  },
  'paper-teal': {
    '--bg-page': '#2a2a2d', '--bg-section': '#faf8f3', '--bg-section-alt': '#f3f0e8', '--bg-dark': '#1a1a1e',
    '--text-primary': '#2a2a2d', '--text-secondary': '#555', '--text-muted': '#999',
    '--text-on-dark': 'rgba(255,255,255,0.85)', '--text-on-dark-dim': 'rgba(255,255,255,0.45)',
    '--accent': '#2dd4a8', '--accent-hover': '#22b890', '--accent-light': 'rgba(45,212,168,0.1)',
    '--border': 'rgba(0,0,0,0.08)', '--border-dark': 'rgba(255,255,255,0.08)', '--border-width': '1px',
    '--font-display': "'Sora', system-ui, sans-serif",
    '--font-body': "'Sora', system-ui, sans-serif",
    '--font-ui': "'Space Mono', ui-monospace, monospace",
    '--radius': '4px',
  },
  'clean-light': {
    '--bg-page': '#111114', '--bg-section': '#ffffff', '--bg-section-alt': '#f8f9fa', '--bg-dark': '#1a1a1e',
    '--text-primary': '#111827', '--text-secondary': '#4b5563', '--text-muted': '#9ca3af',
    '--text-on-dark': 'rgba(255,255,255,0.9)', '--text-on-dark-dim': 'rgba(255,255,255,0.5)',
    '--accent': '#3b82f6', '--accent-hover': '#2563eb', '--accent-light': 'rgba(59,130,246,0.08)',
    '--border': 'rgba(0,0,0,0.08)', '--border-dark': 'rgba(255,255,255,0.08)', '--border-width': '1px',
    '--font-display': "'Inter', system-ui, sans-serif",
    '--font-body': "'Inter', system-ui, sans-serif",
    '--font-ui': "'IBM Plex Mono', ui-monospace, monospace",
    '--radius': '6px',
  },
};

/** Google Fonts import URLs for explainer presets */
const EXPLAINER_FONT_IMPORTS: Record<string, string> = {
  'dark-industrial': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'punk-zine': 'https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Special+Elite&family=VT323&display=swap',
  'paper-teal': 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'clean-light': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap',
};

function generateDocumentCss(baseTheme: string, explainerPreset?: string): string {
  // Reuse the base CSS variables from the legacy generator
  const baseCss = generateCss(baseTheme);

  // If we have an explainer preset, generate its variables for :root
  let presetCss = '';
  const presetVars = explainerPreset ? EXPLAINER_THEME_VARS[explainerPreset] : null;
  if (presetVars) {
    const fontImport = EXPLAINER_FONT_IMPORTS[explainerPreset!];
    const importRule = fontImport ? `@import url('${fontImport}');` : '';
    const vars = Object.entries(presetVars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    presetCss = `${importRule}\n:root {\n${vars}\n}\n`;
  }

  return `${baseCss}\n${presetCss}

/* Scroll viewer layout */
.explainer-scroll-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 var(--space-xl);
}

.explainer-hero {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: var(--section-padding, var(--space-xl));
  background: var(--bg-page, var(--color-bg));
  background-size: cover;
  background-position: center;
  color: var(--text-on-dark, var(--color-text));
}

.explainer-hero__title {
  font-family: var(--font-display, var(--font-heading));
  font-size: 2.5rem;
  color: var(--text-on-dark, var(--color-heading));
  margin-bottom: var(--space-md);
}

.explainer-hero__subtitle {
  font-size: 1.25rem;
  color: var(--text-on-dark-dim, var(--color-text));
  opacity: 0.85;
  max-width: 600px;
}

.explainer-hero__scroll-hint {
  margin-top: var(--space-xl);
  font-size: 0.875rem;
  color: var(--text-on-dark-dim, inherit);
  opacity: 0.5;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.explainer-highlight {
  border-bottom: 2px solid var(--accent, var(--color-accent));
  padding-bottom: 2px;
}

.explainer-doc-section {
  padding: var(--space-xl) 0;
  border-bottom: 1px solid var(--border, var(--color-border));
  background: var(--bg-section, var(--color-bg));
  color: var(--text-primary, var(--color-text));
}

.explainer-doc-section__heading {
  font-family: var(--font-display, var(--font-heading));
  font-size: 1.5rem;
  color: var(--text-primary, var(--color-heading));
  margin-bottom: var(--space-md);
}

.explainer-doc-section__body {
  margin-bottom: var(--space-md);
  line-height: 1.7;
  font-family: var(--font-body, var(--font-body));
}

.explainer-interact {
  background: var(--bg-dark, var(--color-surface));
  border: var(--border-width, 1px) solid var(--border-dark, var(--color-border));
  border-radius: var(--radius, var(--radius-md));
  padding: var(--space-lg);
  margin: var(--space-lg) 0;
  color: var(--text-on-dark, var(--color-text));
}

.explainer-insight {
  background: var(--accent-light, var(--color-primary-light));
  border-left: 3px solid var(--accent, var(--color-primary));
  padding: var(--space-md);
  margin: var(--space-md) 0;
  font-weight: 500;
}

.explainer-bridge {
  font-style: italic;
  opacity: 0.8;
  margin: var(--space-md) 0;
  padding: var(--space-sm) 0;
}

.explainer-aside {
  background: var(--bg-section-alt, var(--color-surface));
  padding: var(--space-md);
  border-radius: var(--radius, var(--radius-md));
  margin: var(--space-md) 0;
  font-size: 0.9rem;
}

.explainer-aside__icon {
  margin-right: var(--space-xs);
}

.explainer-conclusion {
  padding: var(--space-xl) 0;
  text-align: center;
  background: var(--bg-page, var(--color-bg));
  color: var(--text-on-dark, var(--color-text));
}

.explainer-conclusion__heading {
  font-family: var(--font-display, var(--font-heading));
  font-size: 1.75rem;
  color: var(--text-on-dark, var(--color-heading));
  margin-bottom: var(--space-md);
}

.explainer-conclusion__body {
  max-width: 600px;
  margin: 0 auto var(--space-lg);
  line-height: 1.7;
}

.explainer-conclusion__cta {
  display: inline-block;
  background: var(--accent, var(--color-primary));
  color: white;
  text-decoration: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.explainer-conclusion__cta:hover { opacity: 0.9; }

.explainer-footer {
  text-align: center;
  padding: var(--space-lg);
  opacity: 0.5;
  font-size: 0.875rem;
}

.explainer-nav-dots {
  position: fixed;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  z-index: 50;
}

.explainer-nav-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--border-dark, var(--color-border));
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}

.explainer-nav-dot--active {
  background: var(--accent, var(--color-primary));
  border-color: var(--accent, var(--color-primary));
}

.module-slider label { font-weight: 500; display: block; margin-bottom: var(--space-xs); }
.module-slider input[type="range"] { width: 100%; }

.module-quiz__question { font-weight: 600; margin-bottom: var(--space-sm); }
.module-quiz__option { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-xs) 0; cursor: pointer; }

.module-toggle { display: flex; gap: var(--space-sm); }
.module-toggle__btn {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  border-radius: var(--radius-sm);
}
.module-toggle__btn--active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.module-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-md); }
.module-cards__card {
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  background: var(--color-surface);
}

.module-placeholder {
  text-align: center;
  padding: var(--space-md);
  opacity: 0.6;
  font-style: italic;
}

@media (max-width: 768px) {
  .explainer-nav-dots { display: none; }
  .explainer-hero { min-height: 60vh; }
  .explainer-hero__title { font-size: 1.75rem; }
}
`;
}

function generateDocumentJs(sectionCount: number): string {
  return `
(function() {
  'use strict';

  var sections = document.querySelectorAll('.explainer-doc-section');
  var progressFill = document.querySelector('.explainer-progress-bar__fill');
  var navDots = document.querySelectorAll('.explainer-nav-dot');

  // Scroll progress
  function updateProgress() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
    if (progressFill) progressFill.style.width = pct + '%';
  }

  // Active section tracking
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var idx = Array.prototype.indexOf.call(sections, entry.target);
        navDots.forEach(function(dot, i) {
          dot.classList.toggle('explainer-nav-dot--active', i === idx);
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(function(s) { observer.observe(s); });

  // Nav dot clicks
  navDots.forEach(function(dot, i) {
    dot.addEventListener('click', function() {
      if (sections[i]) sections[i].scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Slider output sync
  document.querySelectorAll('.module-slider input[type="range"]').forEach(function(slider) {
    var output = slider.parentElement.querySelector('output');
    if (output) slider.addEventListener('input', function() { output.textContent = slider.value; });
  });

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
})();
`;
}
