import type { BlockTuple } from '@commonpub/editor';
import type { ExplainerSection, QuizQuestion, InteractiveControl } from '../types.js';

/** Escape HTML special characters */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render a BlockTuple array to HTML */
export function renderBlockTuples(blocks: BlockTuple[]): string {
  return blocks
    .map(([type, attrs]) => {
      switch (type) {
        case 'text':
          return `<div class="block-text">${attrs.html as string}</div>`;
        case 'heading': {
          const level = (attrs.level as number) || 2;
          const text = escapeHtml(attrs.text as string);
          return `<h${level} class="block-heading">${text}</h${level}>`;
        }
        case 'code': {
          const code = escapeHtml(attrs.code as string);
          const lang = attrs.language
            ? ` data-language="${escapeHtml(attrs.language as string)}"`
            : '';
          const filename = attrs.filename
            ? `<div class="code-filename">${escapeHtml(attrs.filename as string)}</div>`
            : '';
          return `${filename}<pre class="block-code"${lang}><code>${code}</code></pre>`;
        }
        case 'image': {
          const alt = escapeHtml((attrs.alt as string) || '');
          const src = escapeHtml(attrs.src as string);
          const caption = attrs.caption
            ? `<figcaption>${escapeHtml(attrs.caption as string)}</figcaption>`
            : '';
          return `<figure class="block-image"><img src="${src}" alt="${alt}" loading="lazy" />${caption}</figure>`;
        }
        case 'quote': {
          const attribution = attrs.attribution
            ? `<footer>${escapeHtml(attrs.attribution as string)}</footer>`
            : '';
          return `<blockquote class="block-quote">${attrs.html as string}${attribution}</blockquote>`;
        }
        case 'callout': {
          const variant = (attrs.variant as string) || 'info';
          return `<div class="block-callout block-callout--${escapeHtml(variant)}" role="note">${attrs.html as string}</div>`;
        }
        default:
          return `<div class="block-unknown">${escapeHtml(JSON.stringify(attrs))}</div>`;
      }
    })
    .join('\n');
}

/** Render quiz questions to HTML form markup */
export function renderQuizHtml(questions: QuizQuestion[], sectionId: string): string {
  const questionsHtml = questions
    .map(
      (q, i) => `
    <fieldset class="quiz-question" data-question-id="${escapeHtml(q.id)}">
      <legend class="quiz-question__text">${i + 1}. ${escapeHtml(q.question)}</legend>
      <div class="quiz-question__options" role="radiogroup">
        ${q.options
          .map(
            (opt) => `
          <label class="quiz-option">
            <input type="radio" name="q-${escapeHtml(q.id)}" value="${escapeHtml(opt.id)}" />
            <span class="quiz-option__text">${escapeHtml(opt.text)}</span>
          </label>`,
          )
          .join('\n')}
      </div>
      <div class="quiz-question__feedback" aria-live="polite" hidden></div>
    </fieldset>`,
    )
    .join('\n');

  return `
    <form class="quiz-form" data-section-id="${escapeHtml(sectionId)}" aria-label="Quiz">
      ${questionsHtml}
      <button type="submit" class="quiz-submit">Submit Answers</button>
      <div class="quiz-result" aria-live="polite" hidden></div>
    </form>`;
}

/** Render interactive controls to HTML markup */
export function renderControlsHtml(controls: InteractiveControl[], sectionId: string): string {
  const controlsHtml = controls
    .map((control) => {
      switch (control.type) {
        case 'slider':
          return `
            <div class="control control--slider" data-control-id="${escapeHtml(control.id)}">
              <label for="ctrl-${escapeHtml(control.id)}">${escapeHtml(control.label)}</label>
              <input type="range" id="ctrl-${escapeHtml(control.id)}"
                min="${control.min}" max="${control.max}" step="${control.step}"
                value="${control.defaultValue}" />
              <output for="ctrl-${escapeHtml(control.id)}">${control.defaultValue}</output>
            </div>`;
        case 'toggle':
          return `
            <div class="control control--toggle" data-control-id="${escapeHtml(control.id)}">
              <label>
                <input type="checkbox" id="ctrl-${escapeHtml(control.id)}"
                  ${control.defaultValue ? 'checked' : ''} />
                <span>${escapeHtml(control.label)}</span>
              </label>
            </div>`;
        case 'select':
          return `
            <div class="control control--select" data-control-id="${escapeHtml(control.id)}">
              <label for="ctrl-${escapeHtml(control.id)}">${escapeHtml(control.label)}</label>
              <select id="ctrl-${escapeHtml(control.id)}">
                ${control.options
                  .map(
                    (opt) =>
                      `<option value="${escapeHtml(opt.value)}" ${opt.value === control.defaultValue ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`,
                  )
                  .join('\n')}
              </select>
            </div>`;
        default:
          return '';
      }
    })
    .join('\n');

  return `<div class="controls-panel" data-section-id="${escapeHtml(sectionId)}">${controlsHtml}</div>`;
}

/** Render checkpoint markup */
export function renderCheckpointHtml(sectionId: string, requiresPrevious: boolean): string {
  return `
    <div class="checkpoint" data-section-id="${escapeHtml(sectionId)}" data-requires-previous="${requiresPrevious}">
      <div class="checkpoint__status" aria-live="polite">
        ${requiresPrevious ? '<p class="checkpoint__locked">Complete all previous sections to continue.</p>' : '<p class="checkpoint__ready">You may continue to the next section.</p>'}
      </div>
      <button class="checkpoint__continue" ${requiresPrevious ? 'disabled' : ''}>Continue</button>
    </div>`;
}

/** Render a complete section to HTML */
export function renderSection(section: ExplainerSection): string {
  const contentHtml = renderBlockTuples(section.content);

  let typeSpecificHtml = '';
  switch (section.type) {
    case 'quiz':
      typeSpecificHtml = renderQuizHtml(section.questions, section.id);
      break;
    case 'interactive':
      typeSpecificHtml = renderControlsHtml(section.controls, section.id);
      break;
    case 'checkpoint':
      typeSpecificHtml = renderCheckpointHtml(section.id, section.requiresPrevious);
      break;
  }

  return `
    <section id="${escapeHtml(section.anchor)}" class="explainer-section explainer-section--${escapeHtml(section.type)}" data-section-id="${escapeHtml(section.id)}">
      <h2 class="explainer-section__title">${escapeHtml(section.title)}</h2>
      <div class="explainer-section__content">${contentHtml}</div>
      ${typeSpecificHtml}
    </section>`;
}
