import { describe, it, expect } from 'vitest';
import { generateExplainerHtml } from '../export/htmlExporter';
import type { ExplainerSection, ExplainerDocument, ExportOptions } from '../types';

const defaultOptions: ExportOptions = {
  includeAnimations: false,
  inlineImages: false,
  theme: 'base',
  title: 'Test Explainer',
  description: 'A test explainer',
  author: 'Test Author',
};

// ─── Legacy format tests ────────────────���──────────────────────────

const textSection: ExplainerSection = {
  id: 's1',
  title: 'Introduction',
  anchor: 'introduction',
  type: 'text',
  content: [['text', { html: '<p>Hello world</p>' }]],
};

const quizSection: ExplainerSection = {
  id: 's2',
  title: 'Knowledge Check',
  anchor: 'quiz',
  type: 'quiz',
  content: [['text', { html: '<p>Test your knowledge</p>' }]],
  questions: [
    {
      id: 'q1',
      question: 'What is 2+2?',
      options: [
        { id: 'a', text: '3' },
        { id: 'b', text: '4' },
      ],
      correctOptionId: 'b',
    },
  ],
  passingScore: 70,
  isGate: true,
};

const checkpointSection: ExplainerSection = {
  id: 's3',
  title: 'Checkpoint',
  anchor: 'checkpoint',
  type: 'checkpoint',
  content: [['text', { html: '<p>Review complete</p>' }]],
  requiresPrevious: true,
};

describe('generateExplainerHtml — legacy format', () => {
  it('generates valid HTML document', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes title', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('<title>Test Explainer</title>');
    expect(html).toContain('Test Explainer');
  });

  it('includes meta description', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('meta name="description"');
    expect(html).toContain('A test explainer');
  });

  it('includes author meta', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('meta name="author"');
    expect(html).toContain('Test Author');
  });

  it('includes inlined CSS', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('<style>');
    expect(html).toContain('explainer-section');
  });

  it('includes inlined JS', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('<script>');
    expect(html).toContain('localStorage');
  });

  it('renders section content', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('Hello world');
    expect(html).toContain('id="introduction"');
  });

  it('renders TOC with section links', () => {
    const html = generateExplainerHtml([textSection, quizSection], defaultOptions);
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#quiz"');
    expect(html).toContain('Introduction');
    expect(html).toContain('Knowledge Check');
  });

  it('includes progress bar', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('explainer-progress-bar');
    expect(html).toContain('role="progressbar"');
  });

  it('includes navigation buttons', () => {
    const html = generateExplainerHtml([textSection], defaultOptions);
    expect(html).toContain('nav-prev');
    expect(html).toContain('nav-next');
  });

  it('renders quiz sections with form', () => {
    const html = generateExplainerHtml([quizSection], defaultOptions);
    expect(html).toContain('quiz-form');
    expect(html).toContain('What is 2+2?');
  });

  it('renders checkpoint sections', () => {
    const html = generateExplainerHtml([checkpointSection], defaultOptions);
    expect(html).toContain('checkpoint');
    expect(html).toContain('Review complete');
  });

  it('handles empty sections', () => {
    const html = generateExplainerHtml([], defaultOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Explainer');
  });

  it('omits description meta when not provided', () => {
    const html = generateExplainerHtml([textSection], {
      ...defaultOptions,
      description: undefined,
    });
    expect(html).not.toContain('meta name="description"');
  });

  it('uses theme-specific CSS variables', () => {
    const html = generateExplainerHtml([textSection], { ...defaultOptions, theme: 'agora' });
    expect(html).toContain('#f7f4ed'); // agora bg color
  });

  it('escapes special characters in title', () => {
    const html = generateExplainerHtml([textSection], {
      ...defaultOptions,
      title: 'Test <script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

// ─── ExplainerDocument format tests ────────────────────────────────

const sampleDocument: ExplainerDocument = {
  version: 2,
  theme: 'dark-industrial',
  hero: {
    title: 'Feedback Loops',
    subtitle: 'Why do microphones screech?',
    highlight: 'screech',
    scrollHint: 'Scroll to begin',
  },
  sections: [
    {
      id: 'sec_1',
      anchor: 'start-simple',
      heading: 'What Is a Loop?',
      body: '<p>A loop feeds output back as input.</p>',
      module: {
        type: 'slider',
        props: { label: 'Gain', min: 0, max: 100, step: 1, defaultValue: 50 },
      },
      insight: 'This is called a feedback loop.',
      bridge: '<em>But what happens when gain exceeds 1?</em>',
      aside: { icon: 'lightbulb', label: 'Key idea', text: 'Feedback loops are everywhere.' },
    },
    {
      id: 'sec_2',
      anchor: 'complicate',
      heading: 'When Gain Exceeds 1',
      body: '<p>The system becomes unstable.</p>',
      module: {
        type: 'quiz',
        props: {
          question: 'What happens when gain > 1?',
          options: [
            { text: 'Nothing', correct: false },
            { text: 'Runaway amplification', correct: true },
          ],
        },
      },
      insight: 'Runaway feedback is called positive feedback.',
    },
  ],
  conclusion: {
    heading: 'The Takeaway',
    body: '<p>Feedback loops shape systems from biology to audio engineering.</p>',
    callToAction: { label: 'Learn More', url: '/learn' },
  },
  meta: {
    estimatedMinutes: 5,
    difficulty: 'beginner',
    description: 'An interactive guide to feedback loops',
  },
  settings: {
    showProgressBar: true,
    showNavDots: true,
    showFooter: true,
    footerText: 'An explorable explanation',
  },
};

describe('generateExplainerHtml — ExplainerDocument format', () => {
  it('generates valid HTML document', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('uses hero title as page title', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('<title>Feedback Loops</title>');
  });

  it('renders hero section', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-hero');
    expect(html).toContain('Feedback Loops');
    // Subtitle is split by highlight span, so check parts
    expect(html).toContain('Why do microphones');
    expect(html).toContain('Scroll to begin');
  });

  it('highlights text in subtitle', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-highlight');
    expect(html).toContain('screech');
  });

  it('renders sections with QUESTION > INTERACT > INSIGHT > BRIDGE', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    // Heading (QUESTION)
    expect(html).toContain('What Is a Loop?');
    // Body
    expect(html).toContain('A loop feeds output back as input.');
    // Module (INTERACT)
    expect(html).toContain('explainer-interact');
    expect(html).toContain('module-slider');
    // Insight
    expect(html).toContain('explainer-insight');
    expect(html).toContain('This is called a feedback loop.');
    // Bridge
    expect(html).toContain('explainer-bridge');
    expect(html).toContain('But what happens when gain exceeds 1?');
  });

  it('renders aside callouts', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-aside');
    expect(html).toContain('Key idea');
    expect(html).toContain('Feedback loops are everywhere.');
  });

  it('renders quiz module', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('module-quiz');
    expect(html).toContain('What happens when gain &gt; 1?');
    expect(html).toContain('Runaway amplification');
  });

  it('renders conclusion', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-conclusion');
    expect(html).toContain('The Takeaway');
    expect(html).toContain('Feedback loops shape systems');
  });

  it('renders call-to-action link', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-conclusion__cta');
    expect(html).toContain('Learn More');
    expect(html).toContain('href="/learn"');
  });

  it('renders footer text', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-footer');
    expect(html).toContain('An explorable explanation');
  });

  it('renders nav dots for sections', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-nav-dots');
    expect(html).toContain('explainer-nav-dot');
    // Should have dots for each section
    const dotCount = (html.match(/explainer-nav-dot"/g) || []).length;
    expect(dotCount).toBe(2);
  });

  it('includes progress bar', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('explainer-progress-bar');
    expect(html).toContain('role="progressbar"');
  });

  it('includes scroll-tracking JS', () => {
    const html = generateExplainerHtml(sampleDocument, defaultOptions);
    expect(html).toContain('<script>');
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('scrollIntoView');
  });

  it('omits conclusion when not provided', () => {
    const noConclusion: ExplainerDocument = { ...sampleDocument, conclusion: undefined };
    const html = generateExplainerHtml(noConclusion, defaultOptions);
    // CSS still contains class names, but the actual conclusion content should be absent
    expect(html).not.toContain('The Takeaway');
    expect(html).not.toContain('aria-label="Conclusion"');
  });

  it('omits footer when no footerText', () => {
    const noFooter: ExplainerDocument = { ...sampleDocument, settings: { ...sampleDocument.settings, footerText: undefined } };
    const html = generateExplainerHtml(noFooter, defaultOptions);
    // CSS still contains the class name, but no <footer> element should be rendered
    expect(html).not.toContain('<footer');
  });

  it('handles document with no modules', () => {
    const textOnly: ExplainerDocument = {
      ...sampleDocument,
      sections: [{ id: 'sec_1', anchor: 'intro', heading: 'Intro', body: '<p>Just text.</p>' }],
    };
    const html = generateExplainerHtml(textOnly, defaultOptions);
    expect(html).toContain('Just text.');
    // No data-module-type attribute should appear (CSS still has the class name)
    expect(html).not.toContain('data-module-type');
  });

  it('renders toggle module placeholder', () => {
    const withToggle: ExplainerDocument = {
      ...sampleDocument,
      sections: [{
        id: 'sec_t',
        anchor: 'toggle',
        heading: 'Compare',
        body: '<p>Compare two approaches.</p>',
        module: { type: 'toggle', props: { labelA: 'Approach A', labelB: 'Approach B' } },
      }],
    };
    const html = generateExplainerHtml(withToggle, defaultOptions);
    expect(html).toContain('module-toggle');
    expect(html).toContain('Approach A');
    expect(html).toContain('Approach B');
  });

  it('renders reveal-cards module placeholder', () => {
    const withCards: ExplainerDocument = {
      ...sampleDocument,
      sections: [{
        id: 'sec_c',
        anchor: 'cards',
        heading: 'Cards',
        body: '<p>Flip these cards.</p>',
        module: { type: 'reveal-cards', props: { items: [{ front: 'Card 1' }, { front: 'Card 2' }] } },
      }],
    };
    const html = generateExplainerHtml(withCards, defaultOptions);
    expect(html).toContain('module-cards');
    expect(html).toContain('Card 1');
    expect(html).toContain('Card 2');
  });

  it('renders unknown module as placeholder', () => {
    const withCustom: ExplainerDocument = {
      ...sampleDocument,
      sections: [{
        id: 'sec_u',
        anchor: 'custom',
        heading: 'Custom',
        body: '<p>Custom module.</p>',
        module: { type: 'custom-widget', props: {} },
      }],
    };
    const html = generateExplainerHtml(withCustom, defaultOptions);
    expect(html).toContain('module-placeholder');
    expect(html).toContain('[Interactive: custom-widget]');
  });

  it('sanitizes XSS in section body', () => {
    const xssDoc: ExplainerDocument = {
      ...sampleDocument,
      sections: [{
        id: 'sec_xss',
        anchor: 'xss',
        heading: 'Safe',
        body: '<p>Hello</p><script>alert(1)</script>',
      }],
    };
    const html = generateExplainerHtml(xssDoc, defaultOptions);
    expect(html).toContain('Hello');
    // The script inside body should be stripped by sanitizeRichHtml
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('uses meta description from ExplainerDocument when available', () => {
    const html = generateExplainerHtml(sampleDocument, { ...defaultOptions, description: undefined });
    expect(html).toContain('An interactive guide to feedback loops');
  });
});
