import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registrationMarkdownToTemplate, templateToRegistrationMarkdown } from '../registrationMarkdown';

// The shipped reference form (docs/reference/examples/jinger-registration-form.md)
// is the operator-facing "paste this in → Import" example. It leads with an HTML
// comment header, so this guards that the importer ignores comments AND that the
// documented 41-field rebuild + round-trip actually holds against the real file.
// Walk up from cwd to find it: the layer suite runs from `layers/base` in CI but
// from the repo root locally, so a cwd-relative path is not portable.
const REL = 'docs/reference/examples/jinger-registration-form.md';
function findRepoFile(rel: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, rel);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate ${rel} walking up from ${process.cwd()}`);
}
const md = readFileSync(resolve(findRepoFile(REL)), 'utf8');

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

  it('parses a heading/field that follows a leading inline comment (no indent poisoning)', () => {
    const heading = registrationMarkdownToTemplate('<!-- x --> ## Section\n- Name (text)');
    expect(heading.errors).toEqual([]);
    expect(heading.fields.map((f) => f.type)).toEqual(['section', 'text']);
    const field = registrationMarkdownToTemplate('<!-- note --> - Name (text)');
    expect(field.errors).toEqual([]);
    expect(field.fields).toHaveLength(1);
    expect(field.fields[0].label).toBe('Name');
  });

  it('reports an unterminated comment instead of silently dropping the rest of the form', () => {
    const { fields, errors } = registrationMarkdownToTemplate('- Name (text)\n<!-- todo add more\n- Email (email)');
    expect(fields.map((f) => f.label)).toEqual(['Name']); // the tail is still eaten...
    expect(errors.some((e) => /Unterminated HTML comment/.test(e))).toBe(true); // ...but no longer silently
  });
});
