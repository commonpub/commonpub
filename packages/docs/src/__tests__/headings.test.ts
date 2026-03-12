import { describe, it, expect } from 'vitest';
import { extractHeadings, generateHeadingId } from '../render/headings';

describe('generateHeadingId', () => {
  it('should convert text to lowercase hyphenated id', () => {
    expect(generateHeadingId('Getting Started')).toBe('getting-started');
  });

  it('should strip diacritics', () => {
    expect(generateHeadingId('Résumé')).toBe('resume');
  });

  it('should deduplicate ids', () => {
    const existing = new Set(['getting-started']);
    expect(generateHeadingId('Getting Started', existing)).toBe('getting-started-1');
  });

  it('should handle multiple duplicates', () => {
    const existing = new Set(['intro', 'intro-1']);
    expect(generateHeadingId('Intro', existing)).toBe('intro-2');
  });

  it('should handle empty text', () => {
    expect(generateHeadingId('')).toBe('heading');
  });

  it('should strip special characters', () => {
    expect(generateHeadingId('What is @commonpub/docs?')).toBe('what-is-commonpub-docs');
  });
});

describe('extractHeadings', () => {
  it('should extract h2-h6 headings', () => {
    const md = `# Title (ignored)
## Section 1
### Subsection 1.1
#### Deep heading
## Section 2`;

    const headings = extractHeadings(md);
    expect(headings).toHaveLength(4);
    expect(headings[0]).toEqual({ id: 'section-1', text: 'Section 1', level: 2 });
    expect(headings[1]).toEqual({ id: 'subsection-1-1', text: 'Subsection 1.1', level: 3 });
    expect(headings[2]).toEqual({ id: 'deep-heading', text: 'Deep heading', level: 4 });
    expect(headings[3]).toEqual({ id: 'section-2', text: 'Section 2', level: 2 });
  });

  it('should return empty array for no headings', () => {
    expect(extractHeadings('Just some text.')).toEqual([]);
  });

  it('should deduplicate heading ids', () => {
    const md = `## FAQ
## FAQ`;

    const headings = extractHeadings(md);
    expect(headings[0]!.id).toBe('faq');
    expect(headings[1]!.id).toBe('faq-1');
  });

  it('should ignore h1 headings', () => {
    const md = '# Title\n## Content';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(1);
    expect(headings[0]!.text).toBe('Content');
  });
});
