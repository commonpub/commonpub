import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { registrationMarkdownToTemplate, templateToRegistrationMarkdown } from '../registrationMarkdown';

// The shipped reference form (docs/reference/examples/jinger-registration-form.md)
// is the operator-facing "paste this in → Import" example. It leads with an HTML
// comment header, so this guards that the importer ignores comments AND that the
// documented 41-field rebuild + round-trip actually holds against the real file.
const md = readFileSync(process.cwd() + '/docs/reference/examples/jinger-registration-form.md', 'utf8');

describe('jinger reference form import', () => {
  it('parses the real example file with no errors into 41 fields (31 + 10 sections)', () => {
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields.length).toBe(41);
    expect(fields.filter((f) => f.type === 'section').length).toBe(10);
    expect(fields.filter((f) => f.type !== 'section').length).toBe(31);
  });

  it('round-trips import -> export -> import identically', () => {
    const first = registrationMarkdownToTemplate(md).fields;
    const second = registrationMarkdownToTemplate(templateToRegistrationMarkdown(first)).fields;
    expect(second).toEqual(first);
  });
});

describe('HTML comment handling', () => {
  it('ignores a multi-line comment header', () => {
    const { fields, errors } = registrationMarkdownToTemplate(
      '<!-- a header\n   spanning lines -->\n## Section\n- Name* (text)',
    );
    expect(errors).toEqual([]);
    expect(fields.map((f) => f.type)).toEqual(['section', 'text']);
  });

  it('ignores an inline comment and keeps the rest of the line', () => {
    const { fields, errors } = registrationMarkdownToTemplate('- Name* (text) <!-- note -->');
    expect(errors).toEqual([]);
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe('Name');
  });

  it('does not treat a bare < or an email placeholder as a comment', () => {
    const { fields, errors } = registrationMarkdownToTemplate('- Age < 18? (checkbox)');
    expect(errors).toEqual([]);
    expect(fields[0].label).toBe('Age < 18?');
  });
});
