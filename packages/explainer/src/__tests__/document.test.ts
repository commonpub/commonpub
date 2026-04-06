import { describe, it, expect } from 'vitest';
import { isExplainerDocument } from '../types';
import {
  explainerDocumentSchema,
  moduleConfigSchema,
  explainerDocSectionSchema,
  explainerHeroSchema,
  explainerConclusionSchema,
  explainerThemePresetSchema,
} from '../schemas';

// ═══ TYPE GUARD ═══

describe('isExplainerDocument', () => {
  const validDoc = {
    version: 2,
    theme: 'dark-industrial',
    hero: { title: 'Test Explainer' },
    sections: [
      { id: 's1', anchor: 'intro', heading: 'Introduction', body: '<p>Hello</p>' },
    ],
    meta: { estimatedMinutes: 10, difficulty: 'beginner' },
  };

  it('should return true for a valid ExplainerDocument', () => {
    expect(isExplainerDocument(validDoc)).toBe(true);
  });

  it('should return true with all optional fields', () => {
    expect(isExplainerDocument({
      ...validDoc,
      conclusion: { heading: 'Done', body: '<p>Summary</p>' },
      settings: { showProgressBar: true, showNavDots: true },
    })).toBe(true);
  });

  it('should return false for null', () => {
    expect(isExplainerDocument(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isExplainerDocument(undefined)).toBe(false);
  });

  it('should return false for a string', () => {
    expect(isExplainerDocument('hello')).toBe(false);
  });

  it('should return false for a number', () => {
    expect(isExplainerDocument(42)).toBe(false);
  });

  it('should return false for BlockTuple[] (legacy format)', () => {
    const blockTuples = [
      ['paragraph', { html: '<p>Hello</p>' }],
      ['heading', { text: 'Title', level: 2 }],
    ];
    expect(isExplainerDocument(blockTuples)).toBe(false);
  });

  it('should return false for wrong version', () => {
    expect(isExplainerDocument({ ...validDoc, version: 1 })).toBe(false);
  });

  it('should return false for missing hero', () => {
    const { hero: _, ...noHero } = validDoc;
    expect(isExplainerDocument(noHero)).toBe(false);
  });

  it('should return false for missing sections', () => {
    const { sections: _, ...noSections } = validDoc;
    expect(isExplainerDocument(noSections)).toBe(false);
  });

  it('should return false for sections not being an array', () => {
    expect(isExplainerDocument({ ...validDoc, sections: 'not an array' })).toBe(false);
  });

  it('should return false for an empty object', () => {
    expect(isExplainerDocument({})).toBe(false);
  });
});

// ═══ SCHEMA VALIDATION ═══

describe('explainerThemePresetSchema', () => {
  it('should accept valid presets', () => {
    expect(explainerThemePresetSchema.safeParse('dark-industrial').success).toBe(true);
    expect(explainerThemePresetSchema.safeParse('punk-zine').success).toBe(true);
    expect(explainerThemePresetSchema.safeParse('paper-teal').success).toBe(true);
    expect(explainerThemePresetSchema.safeParse('clean-light').success).toBe(true);
  });

  it('should reject invalid preset', () => {
    expect(explainerThemePresetSchema.safeParse('neon-purple').success).toBe(false);
  });
});

describe('moduleConfigSchema', () => {
  it('should accept valid module config', () => {
    const result = moduleConfigSchema.safeParse({
      type: 'slider',
      props: { label: 'Amount', min: 0, max: 100, step: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept module with empty props', () => {
    const result = moduleConfigSchema.safeParse({
      type: 'text-only',
      props: {},
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing type', () => {
    const result = moduleConfigSchema.safeParse({
      props: { min: 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe('explainerDocSectionSchema', () => {
  it('should accept a full section', () => {
    const result = explainerDocSectionSchema.safeParse({
      id: 'sec1',
      anchor: 'start-simple',
      heading: 'Start Simple',
      body: '<p>Imagine you get paid $10 every day.</p>',
      module: { type: 'slider', props: { label: '$/day', min: 1, max: 50 } },
      insight: 'Linear growth adds the same amount each step.',
      bridge: '<em>But what happens when the output feeds back?</em>',
      aside: { icon: 'lightbulb', label: 'Key idea', text: 'Every step adds the same.' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept a text-only section (no module)', () => {
    const result = explainerDocSectionSchema.safeParse({
      id: 'sec2',
      anchor: 'text-section',
      heading: 'Some Context',
      body: '<p>Background information.</p>',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing heading', () => {
    const result = explainerDocSectionSchema.safeParse({
      id: 'bad',
      anchor: 'bad',
      body: '<p>No heading</p>',
    });
    expect(result.success).toBe(false);
  });
});

describe('explainerHeroSchema', () => {
  it('should accept minimal hero', () => {
    const result = explainerHeroSchema.safeParse({ title: 'Feedback Loops' });
    expect(result.success).toBe(true);
  });

  it('should accept full hero', () => {
    const result = explainerHeroSchema.safeParse({
      title: 'Feedback Loops',
      subtitle: 'A tiny push becomes an avalanche.',
      highlight: 'Why does everything spiral?',
      scrollHint: 'Scroll to find out',
      coverImageUrl: 'https://example.com/cover.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty title', () => {
    const result = explainerHeroSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });
});

describe('explainerConclusionSchema', () => {
  it('should accept minimal conclusion', () => {
    const result = explainerConclusionSchema.safeParse({
      heading: 'So What?',
      body: '<p>Summary paragraph.</p>',
    });
    expect(result.success).toBe(true);
  });

  it('should accept conclusion with CTA', () => {
    const result = explainerConclusionSchema.safeParse({
      heading: 'Next Steps',
      body: '<p>Continue learning.</p>',
      callToAction: { label: 'Try the tool', url: 'https://example.com' },
    });
    expect(result.success).toBe(true);
  });
});

describe('explainerDocumentSchema', () => {
  it('should accept a valid complete document', () => {
    const result = explainerDocumentSchema.safeParse({
      version: 2,
      theme: 'dark-industrial',
      hero: { title: 'Feedback Loops', subtitle: 'A tiny push becomes an avalanche.' },
      sections: [
        {
          id: 's1',
          anchor: 'linear-growth',
          heading: 'Start Simple: Linear Growth',
          body: '<p>Imagine you get paid $10 every day.</p>',
          module: { type: 'slider', props: { label: '$/day', min: 1, max: 50, default: 10 } },
          insight: 'Linear growth means every step adds the same amount.',
          bridge: '<em>Nothing weird here. But what happens when the output feeds back?</em>',
        },
        {
          id: 's2',
          anchor: 'exponential',
          heading: 'Now Feed It Back',
          body: '<p>What if you earned a percentage of what you already have?</p>',
          module: { type: 'slider', props: { label: 'Growth %', min: 1, max: 30, default: 5 } },
          insight: 'This is exponential growth.',
        },
      ],
      conclusion: { heading: 'So What?', body: '<p>Feedback loops are everywhere.</p>' },
      meta: { estimatedMinutes: 15, difficulty: 'beginner' },
      settings: { showProgressBar: true, showNavDots: true, showFooter: true },
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong version number', () => {
    const result = explainerDocumentSchema.safeParse({
      version: 1,
      theme: 'dark-industrial',
      hero: { title: 'Test' },
      sections: [{ id: 's1', anchor: 'a', heading: 'H', body: '' }],
      meta: { estimatedMinutes: 5, difficulty: 'beginner' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty sections array', () => {
    const result = explainerDocumentSchema.safeParse({
      version: 2,
      theme: 'dark-industrial',
      hero: { title: 'Test' },
      sections: [],
      meta: { estimatedMinutes: 5, difficulty: 'beginner' },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid theme', () => {
    const result = explainerDocumentSchema.safeParse({
      version: 2,
      theme: 'neon-purple',
      hero: { title: 'Test' },
      sections: [{ id: 's1', anchor: 'a', heading: 'H', body: '' }],
      meta: { estimatedMinutes: 5, difficulty: 'beginner' },
    });
    expect(result.success).toBe(false);
  });
});
