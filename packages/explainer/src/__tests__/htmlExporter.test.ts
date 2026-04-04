import { describe, it, expect } from 'vitest';
import { generateExplainerHtml } from '../export/htmlExporter';
import type { ExplainerSection, ExportOptions } from '../types';

const defaultOptions: ExportOptions = {
  includeAnimations: false,
  inlineImages: false,
  theme: 'base',
  title: 'Test Explainer',
  description: 'A test explainer',
  author: 'Test Author',
};

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

describe('generateExplainerHtml', () => {
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
