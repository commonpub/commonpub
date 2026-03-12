import type { ExplainerSection, ExportOptions } from '../types.js';
import { renderSection } from '../render/sectionRenderer.js';
import { generateCss, generateJs } from './templates.js';
import { minifyCss, minifyJs, wrapStyle, wrapScript } from './inlineAssets.js';

/** Generate a self-contained HTML document from explainer sections */
export function generateExplainerHtml(
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
