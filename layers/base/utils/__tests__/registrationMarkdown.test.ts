import { describe, it, expect } from 'vitest';
import { registrationMarkdownToTemplate, templateToRegistrationMarkdown } from '../registrationMarkdown';

describe('registrationMarkdownToTemplate', () => {
  it('parses sections, help, and basic fields', () => {
    const md = `## Participant
Tell us about yourself.

- Full Name* (text)
- Email* (email, pii)
  > We never show this publicly.`;
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({ type: 'section', label: 'Participant', help: 'Tell us about yourself.' });
    expect(fields[1]).toMatchObject({ type: 'text', label: 'Full Name', required: true, key: 'full_name' });
    expect(fields[2]).toMatchObject({ type: 'email', label: 'Email', required: true, pii: true, help: 'We never show this publicly.' });
  });

  it('parses select/radio options with auto + explicit values', () => {
    const md = `- Track* (select): Developer, Startup
- Size (radio): small=Small team, large=Large team`;
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields[0].options).toEqual([
      { value: 'developer', label: 'Developer' },
      { value: 'startup', label: 'Startup' },
    ]);
    expect(fields[1].options).toEqual([
      { value: 'small', label: 'Small team' },
      { value: 'large', label: 'Large team' },
    ]);
  });

  it('parses agreement terms from indented bullets', () => {
    const md = `- Eligibility* (agreement)
  - I am 18 or older.
  - I am a US resident.`;
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields[0]).toMatchObject({ type: 'agreement', required: true, mustAccept: true });
    expect(fields[0].terms).toBe('I am 18 or older.\nI am a US resident.');
  });

  it('parses file modifiers (accept/size) and aliases', () => {
    const md = `- Doc (file, accept=application/pdf, size=10240)
- Phone* (phone, pii)`;
    const { fields } = registrationMarkdownToTemplate(md);
    expect(fields[0]).toMatchObject({ type: 'file', accept: 'application/pdf', maxSizeKb: 10240 });
    expect(fields[1]).toMatchObject({ type: 'tel', required: true, pii: true });
  });

  it('handles a multi-MIME accept list (commas inside the value)', () => {
    const md = `- Doc (file, accept=application/pdf,image/png,image/jpeg, size=10240)`;
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields[0]).toMatchObject({ type: 'file', accept: 'application/pdf,image/png,image/jpeg', maxSizeKb: 10240 });
    // and it survives a round-trip (serialized with | then re-parsed)
    const back = registrationMarkdownToTemplate(templateToRegistrationMarkdown(fields));
    expect(back.fields[0].accept).toBe('application/pdf,image/png,image/jpeg');
  });

  it('de-duplicates keys derived from identical labels', () => {
    const md = `- Name (text)\n- Name (text)`;
    const { fields } = registrationMarkdownToTemplate(md);
    expect(fields.map((f) => f.key)).toEqual(['name', 'name_2']);
  });

  it('de-dupes ≤40-char keys without hanging (long labels sharing a 40-char slug)', () => {
    const long = 'A'.repeat(50); // slugs to 40 chars, so two of them collide on the cap
    const { fields, errors } = registrationMarkdownToTemplate(`- ${long} one (text)\n- ${long} two (text)`);
    expect(errors).toEqual([]);
    expect(fields).toHaveLength(2);
    expect(fields[0].key).not.toBe(fields[1].key);
    expect(fields[0].key.length).toBeLessThanOrEqual(40);
    expect(fields[1].key.length).toBeLessThanOrEqual(40);
  });

  it('flags a select without options and an agreement without terms', () => {
    const { errors } = registrationMarkdownToTemplate(`- Track (select)\n- Terms (agreement)`);
    expect(errors.some((e) => /no options/.test(e))).toBe(true);
    expect(errors.some((e) => /no terms/.test(e))).toBe(true);
  });

  it('defaults type to text and required to false', () => {
    const { fields } = registrationMarkdownToTemplate(`- Nickname`);
    expect(fields[0]).toMatchObject({ type: 'text', required: false, label: 'Nickname' });
  });

  it('does not crash on adversarial labels (delimiters, unicode) or empty input', () => {
    expect(registrationMarkdownToTemplate('').fields).toEqual([]);
    // A label with the DSL's own delimiters + unicode should still yield a field, not throw.
    const { fields } = registrationMarkdownToTemplate('- Émigré status: résumé? (text)\n- 日本語 (email, pii)');
    expect(fields.length).toBe(2);
    expect(fields.every((f) => /^[a-z0-9_]*$/.test(f.key))).toBe(true); // keys are always schema-safe
  });

  it('a select whose option label contains no alnum still yields a non-empty value', () => {
    const { fields } = registrationMarkdownToTemplate('- Pick (select): ***, +++');
    expect(fields[0].options?.every((o) => o.value.length > 0)).toBe(true);
  });

  it('round-trips labels containing the DSL delimiters ( ) : and a trailing *', () => {
    const tmpl = [
      { key: 'deadline', label: 'Deadline: when?', type: 'text', required: false },
      { key: 'shirt', label: 'Shirt size (S/M/L)', type: 'text', required: false },
      { key: 'rate', label: 'Rate 5*', type: 'text', required: false },
      { key: 'region', label: 'Region: pick', type: 'select', required: true,
        options: [{ value: 'us', label: 'US' }, { value: 'ca', label: 'CA' }] },
    ] as import('@commonpub/schema').FormField[];
    const md = templateToRegistrationMarkdown(tmpl);
    const { fields, errors } = registrationMarkdownToTemplate(md);
    expect(errors).toEqual([]);
    expect(fields.map((f) => f.label)).toEqual(['Deadline: when?', 'Shirt size (S/M/L)', 'Rate 5*', 'Region: pick']);
    expect(fields[2].required).toBe(false); // trailing * did NOT flip required
    expect(fields[3]).toMatchObject({ type: 'select', required: true });
    expect(fields[3].options).toEqual([{ value: 'us', label: 'US' }, { value: 'ca', label: 'CA' }]);
  });

  it('flags an explicit empty option value (=Label) instead of silently passing it', () => {
    const { fields, errors } = registrationMarkdownToTemplate('- Pick (select): =Yes, no=No');
    expect(errors.some((e) => /empty value/.test(e))).toBe(true);
    expect(fields[0].options).toEqual([{ value: 'no', label: 'No' }]);
  });

  it('merges a bare-extension accept list and tab-indented terms', () => {
    const { fields, errors } = registrationMarkdownToTemplate(
      '- Doc (file, accept=.png,.jpg,.gif)\n- Eligible (agreement)\n\t- I qualify.',
    );
    expect(errors).toEqual([]);
    expect(fields[0].accept).toBe('.png,.jpg,.gif');
    expect(fields[1].terms).toBe('I qualify.'); // tab-indented term attached, not an error
  });
});

describe('round-trip (template -> markdown -> template)', () => {
  it('is stable for a representative mixed form', () => {
    const md = `## Challenge Track

- Challenge Track* (select): Developer, Startup
  > Choose your track.

## Consent

- Eligibility* (agreement)
  - I am 18 or older.
  - I am a US resident.
- Ship Address* (address)
- Signature* (signature, pii)`;
    const first = registrationMarkdownToTemplate(md);
    expect(first.errors).toEqual([]);
    const regenerated = templateToRegistrationMarkdown(first.fields);
    const second = registrationMarkdownToTemplate(regenerated);
    expect(second.errors).toEqual([]);
    // Field-level equality survives the round-trip.
    expect(second.fields).toEqual(first.fields);
  });
});
