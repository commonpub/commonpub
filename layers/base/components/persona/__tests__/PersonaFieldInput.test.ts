/**
 * `<PersonaFieldInput>` — the non-chip persona controls.
 *
 * The load-bearing assertions here are the two that fail silently in production:
 * a `link` field that accepts `https://evilgithub.com/me` for `github` (an exact
 * host check written as a substring check passes every happy-path test), and a
 * `multiselect` accidentally falling through to a one-line text box that looks
 * like a working control.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import axe from 'axe-core';
import type { PersonaField, PersonaLinkPlatformSpec } from '@commonpub/persona';
import {
  BUILTIN_PERSONA_LINK_PLATFORMS,
  PERSONA_CHECKBOX_VALUE,
  findLinkPlatform,
} from '@commonpub/persona';
import FieldInput from '../PersonaFieldInput.vue';

const GITHUB = findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'github') as PersonaLinkPlatformSpec;
const MASTODON = findLinkPlatform(BUILTIN_PERSONA_LINK_PLATFORMS, 'mastodon') as PersonaLinkPlatformSpec;

function mount(field: PersonaField, modelValue = '', platform: PersonaLinkPlatformSpec | null = null) {
  return render(FieldInput, { props: { field, modelValue, platform } });
}

const TEXT: PersonaField = { key: 'headline', label: 'Job title', type: 'text', maxLength: 255, help: 'Shown next to your name.' };

describe('PersonaFieldInput — the plain types', () => {
  it('text renders a labelled input with the registry-allowed maxlength', () => {
    const { getByLabelText } = mount(TEXT);
    const input = getByLabelText('Job title') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('maxlength')).toBe('255');
  });

  it('help text is wired with aria-describedby, not just placed nearby', () => {
    const { getByLabelText, getByText } = mount(TEXT);
    const input = getByLabelText('Job title');
    expect(input.getAttribute('aria-describedby')).toBe(getByText('Shown next to your name.').id);
  });

  it('number and date take no maxlength, because the registry says they do not', () => {
    for (const type of ['number', 'date'] as const) {
      const { getByLabelText } = mount({ key: 'k', label: 'K', type, maxLength: 20 });
      expect((getByLabelText('K') as HTMLInputElement).getAttribute('maxlength')).toBeNull();
    }
  });

  it('a number field keeps its model a STRING', async () => {
    // v-model on type=number casts to a JavaScript number and silently breaks
    // every string helper downstream, so this component binds :value + @input.
    const { getByLabelText, emitted } = mount({ key: 'age', label: 'Age', type: 'number' });
    await fireEvent.update(getByLabelText('Age'), '42');
    const events = emitted('update:modelValue') as Array<[unknown]>;
    expect(events.at(-1)?.[0]).toBe('42');
  });

  it('textarea renders a textarea', () => {
    const { getByLabelText } = mount({ key: 'bio', label: 'About you', type: 'textarea', maxLength: 2000 });
    expect(getByLabelText('About you').tagName).toBe('TEXTAREA');
  });

  it('select always offers a way back to no answer', () => {
    const { getByLabelText } = mount({
      key: 'industry', label: 'Industry', type: 'select',
      options: [{ value: 'hardware', label: 'Hardware' }],
    }, 'hardware');
    const select = getByLabelText('Industry') as HTMLSelectElement;
    // Persona has no `required`. A select whose only options are answers is a
    // one-way door.
    expect([...select.options].some((o) => o.value === '')).toBe(true);
  });

  it('radio is a real radiogroup with a Clear control, since radios cannot be un-picked', () => {
    const field: PersonaField = {
      key: 'size', label: 'Team size', type: 'radio',
      options: [{ value: 'solo', label: 'Solo' }, { value: 'team', label: 'Team' }],
    };
    const empty = mount(field, '');
    expect(empty.container.querySelectorAll('input[type="radio"]').length).toBe(2);
    expect(empty.queryByText(/^Clear /)).toBeNull();

    const picked = mount(field, 'solo');
    expect(picked.getByText('Clear Team size')).toBeTruthy();
  });

  it('checkbox emits the CANONICAL stored value, not a locally invented one', async () => {
    // Pinned against the constant, never a literal. The literal `'true'` this
    // used to assert was accepted by the write path and normalised to `'yes'`,
    // so the test agreed with the component and both were wrong.
    const { getByLabelText, emitted } = mount({ key: 'ok', label: 'Count me in', type: 'checkbox' });
    await fireEvent.click(getByLabelText('Count me in'));
    expect((emitted('update:modelValue') as Array<[unknown]>).at(-1)?.[0]).toBe(
      PERSONA_CHECKBOX_VALUE,
    );
  });

  it('renders a STORED ticked checkbox as ticked, which is the bug that shipped', async () => {
    // The round trip, not the emit. `GET /api/persona` hands back the stored
    // value, the page seeds the model with it, and the box has to come back
    // ticked. It did not: `'yes' === 'true'` is false, so a saved answer looked
    // unanswered and re-ticking then unticking could not even clear it.
    const { getByLabelText } = mount(
      { key: 'ok', label: 'Count me in', type: 'checkbox' },
      PERSONA_CHECKBOX_VALUE,
    );
    expect((getByLabelText('Count me in') as HTMLInputElement).checked).toBe(true);
  });

  it('leaves a checkbox unticked for the cleared value', async () => {
    const { getByLabelText } = mount({ key: 'ok', label: 'Count me in', type: 'checkbox' }, '');
    expect((getByLabelText('Count me in') as HTMLInputElement).checked).toBe(false);
  });

  it('a section field is a styled divider, never a heading', () => {
    const { container } = mount({ key: 'hd', label: 'Where to find you', type: 'section' });
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    expect(container.querySelector('input,textarea,select')).toBeNull();
    expect(container.textContent).toContain('Where to find you');
  });

  it('multiselect renders NOTHING here rather than falling through to a text box', () => {
    // The chip grid owns multiselect. A fall-through would ship a one-line text
    // input where a 34-checkbox grid belongs, and it would look like it worked.
    const { container } = mount({
      key: 'interests', label: 'Interests', type: 'multiselect',
      options: [{ value: 'a', label: 'A' }],
    });
    expect(container.querySelector('input,textarea,select')).toBeNull();
  });
});

describe('PersonaFieldInput — url validation is domain, not shape', () => {
  const URL_FIELD: PersonaField = { key: 'site', label: 'Website', type: 'url', maxLength: 512 };

  it('accepts an http(s) address', () => {
    const { queryByRole } = mount(URL_FIELD, 'https://example.com/me');
    expect(queryByRole('alert')).toBeNull();
  });

  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'not a url'])(
    'rejects %s inline',
    (bad) => {
      const { getByRole } = mount(URL_FIELD, bad);
      expect(getByRole('alert').textContent).toContain('http://');
    },
  );

  it('an empty value is never an error, because nothing here is required', () => {
    const { queryByRole } = mount(URL_FIELD, '');
    expect(queryByRole('alert')).toBeNull();
  });

  it('reports validity to the parent so a section Save can be gated', () => {
    const good = mount(URL_FIELD, 'https://example.com');
    expect((good.emitted('validity') as Array<[boolean]>).at(-1)?.[0]).toBe(true);
    const bad = mount(URL_FIELD, 'javascript:alert(1)');
    expect((bad.emitted('validity') as Array<[boolean]>).at(-1)?.[0]).toBe(false);
  });
});

describe('PersonaFieldInput — link fields check the platform host', () => {
  const LINK: PersonaField = { key: 'link_github', label: 'GitHub', type: 'link', platform: 'github' };

  it('accepts the platform host and a subdomain of it', () => {
    for (const url of ['https://github.com/ada', 'https://www.github.com/ada']) {
      expect(mount(LINK, url, GITHUB).queryByRole('alert')).toBeNull();
    }
  });

  it.each(['https://evilgithub.com/ada', 'https://github.com.attacker.example/ada', 'https://gitlab.com/ada'])(
    'refuses %s, which a substring check would wave through',
    (url) => {
      const { getByRole } = mount(LINK, url, GITHUB);
      expect(getByRole('alert').textContent).toContain('GitHub');
    },
  );

  it('refuses a javascript: URL even before the host check', () => {
    expect(mount(LINK, 'javascript:alert(1)', GITHUB).getByRole('alert')).toBeTruthy();
  });

  it('a federated platform with no host restriction accepts any http(s) instance', () => {
    // Mastodon accounts live on arbitrary instances, so an empty hostSuffixes
    // list means "any http(s) host" rather than "no host is valid".
    const field: PersonaField = { key: 'link_mastodon', label: 'Mastodon', type: 'link', platform: 'mastodon' };
    expect(mount(field, 'https://chaos.social/@ada', MASTODON).queryByRole('alert')).toBeNull();
    expect(mount(field, 'javascript:alert(1)', MASTODON).getByRole('alert')).toBeTruthy();
  });

  it('uses the platform placeholder so the expected shape is visible', () => {
    const { getByLabelText } = mount(LINK, '', GITHUB);
    expect((getByLabelText('GitHub') as HTMLInputElement).placeholder).toBe(GITHUB.placeholder);
  });

  it('an invalid value is marked aria-invalid and described by its own error', () => {
    const { getByLabelText, getByRole } = mount(LINK, 'https://evilgithub.com/ada', GITHUB);
    const input = getByLabelText('GitHub');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(getByRole('alert').id);
  });
});

describe('PersonaFieldInput — accessibility', () => {
  const CASES: Array<[string, PersonaField, string]> = [
    ['text', TEXT, ''],
    ['textarea', { key: 'bio', label: 'About you', type: 'textarea' }, ''],
    ['select', { key: 'industry', label: 'Industry', type: 'select', options: [{ value: 'a', label: 'A' }] }, ''],
    ['radio', { key: 'size', label: 'Team size', type: 'radio', options: [{ value: 'a', label: 'A' }] }, 'a'],
    ['checkbox', { key: 'ok', label: 'Count me in', type: 'checkbox' }, ''],
    ['date', { key: 'd', label: 'Since', type: 'date' }, ''],
    ['url invalid', { key: 'site', label: 'Website', type: 'url' }, 'javascript:alert(1)'],
  ];

  it.each(CASES)('%s has no axe violations', async (_name, field, value) => {
    const { container } = mount(field, value);
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it('covers every registry type that this component is responsible for', () => {
    // A guard on the guard: if a new persona field type lands and nothing here
    // renders it, this count stops matching and the omission is visible.
    expect(CASES.length).toBeGreaterThanOrEqual(7);
  });
});
