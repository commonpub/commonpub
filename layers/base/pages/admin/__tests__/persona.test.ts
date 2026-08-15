/**
 * Component tests for `/admin/persona`, the operator persona schema editor.
 *
 * The three the brief names are the three the contest builder gets wrong, and
 * each one is a data-loss path rather than a cosmetic difference:
 *
 *  1. a blank choice option BLOCKS the save and NAMES the field (the contest
 *     builder ships it to the server, which 400s with nothing marked in the
 *     form);
 *  2. renaming a label does NOT rewrite the machine key (`contestStages.ts`
 *     re-derives the key from the label, which in a persona orphans every
 *     user's rows for that field);
 *  3. changing a machine key shows a confirmation that NAMES THE COUNT it is
 *     about to discard.
 *
 * Everything is asserted through the rendered DOM. Element ids are positional
 * (`field-key-<sectionIndex>-<fieldIndex>`) precisely so a test can address a
 * field without reaching into component state.
 *
 * Fixture layout, referenced throughout:
 *   section 0 `basics`    -> field 0 `display_name`, field 1 `industry`
 *   section 1 `interests` -> field 0 `interests`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref, computed, type Ref } from 'vue';

interface WireField {
  key: string;
  label: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
  maxSelections?: number;
  column?: string;
}

interface WireSection {
  key: string;
  label: string;
  fields: WireField[];
}

interface WireDrift {
  kind: 'missing_field' | 'type_changed' | 'sink_changed' | 'missing_option';
  fieldKey: string;
  detail: string;
  affectedRows: number;
  acknowledgedAt: string | null;
}

interface WireResponse {
  file: WireSection[] | null;
  fileError?: string | null;
  db: WireSection[] | null;
  effective: WireSection[];
  source: 'database' | 'config' | 'builtin';
  savedAt: string | null;
  drift: WireDrift[];
  rowCounts?: Record<string, number>;
  lockedKeys?: string[];
  platforms?: Array<{ key: string; label: string }>;
  retired?: Array<{ fieldKey: string; retiredAt: string }>;
}

const SECTIONS: WireSection[] = [
  {
    key: 'basics',
    label: 'Basics',
    fields: [
      { key: 'display_name', label: 'Display name', type: 'text', column: 'displayName' },
      {
        key: 'industry',
        label: 'Industry',
        type: 'select',
        options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'software', label: 'Software' },
        ],
      },
    ],
  },
  {
    key: 'interests',
    label: 'Interests',
    fields: [
      {
        key: 'interests',
        label: 'What are you into?',
        type: 'multiselect',
        maxSelections: 5,
        options: [
          { value: 'pcb', label: 'PCB design' },
          { value: 'cnc', label: 'CNC' },
        ],
      },
    ],
  },
];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function makeResponse(overrides: Partial<WireResponse> = {}): WireResponse {
  return {
    file: clone(SECTIONS),
    fileError: null,
    db: null,
    effective: clone(SECTIONS),
    source: 'config',
    savedAt: null,
    drift: [],
    rowCounts: { display_name: 0, industry: 91, interests: 412 },
    lockedKeys: ['display_name', 'industry', 'interests'],
    ...overrides,
  };
}

const toast = { success: vi.fn(), error: vi.fn() };
/** Set to make the NEXT PUT reject, then cleared, mimicking one refusal. */
let putError: unknown = null;

// Typed with its parameters so `mock.calls[n][1]` is a real tuple element:
// `vi.fn(async () => ...)` produces a zero-length call tuple, and every
// assertion about a request body then fails to typecheck (vue-tsc is strict
// where vitest's esbuild transform is not).
const $fetch = vi.fn(async (_url: string, opts?: unknown) => {
  const method = (opts as { method?: string } | undefined)?.method;
  if (method === 'PUT' && putError !== null) {
    const thrown = putError;
    putError = null;
    throw thrown;
  }
  return {};
});

/**
 * h3 nests a handler's `data` one level deeper than the handler wrote it, which
 * is why `err.data.errors` once rendered every Zod failure in this app as the
 * bare status message. The fixture reproduces the REAL nesting rather than the
 * one the page would like.
 */
function h3Error(statusCode: number, data: Record<string, unknown>): unknown {
  return { statusCode, data: { statusCode, message: 'error', data } };
}
const refresh = vi.fn(async () => {});
const personaFlag = ref(true);
const canManage = ref(true);
const responseRef: Ref<WireResponse | null> = ref(makeResponse());

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useSiteName: () => 'Test',
  useToast: () => toast,
  useCan: () => computed(() => canManage.value),
  useFeatures: () => ({ persona: computed(() => personaFlag.value) }),
  useFetch: () => ({ data: responseRef, refresh, pending: ref(false) }),
  $fetch,
});

// Imported after the auto-import stubs are installed: the compiled component
// calls useSiteName() while its module body runs, not at mount.
const PersonaPage = (await import('../persona.vue')).default;

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
  $fetch.mockClear();
  refresh.mockClear();
  personaFlag.value = true;
  canManage.value = true;
  putError = null;
  responseRef.value = makeResponse();
});

function putCall(): [string, unknown] | undefined {
  return $fetch.mock.calls.find(
    (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
  ) as [string, unknown] | undefined;
}

function mount(): ReturnType<typeof render> {
  return render(PersonaPage, {
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  });
}

function el<T extends HTMLElement>(container: Element, selector: string): T {
  const found = container.querySelector(selector);
  if (!found) throw new Error(`No element matched ${selector}`);
  return found as T;
}

/** Every button offering to save. There is one in the header and one in the sticky footer. */
function saveButtons(container: Element): HTMLButtonElement[] {
  return ([...container.querySelectorAll('button')] as HTMLButtonElement[]).filter(
    (b) => b.textContent?.trim() === 'Save',
  );
}

function alertText(container: Element): string {
  return [...container.querySelectorAll('[role="alert"]')].map((n) => n.textContent ?? '').join(' ');
}

/** The unlock button that sits under one field's machine key input. */
function unlockButton(container: Element, si: number, fi: number): HTMLButtonElement {
  const control = el(container, `#field-key-${si}-${fi}`).closest('.cpub-persona-control');
  const button = control?.querySelector('.cpub-persona-key-actions button');
  if (!button) throw new Error(`No key action button for field ${si}-${fi}`);
  return button as HTMLButtonElement;
}

describe('/admin/persona — pre-save validation', () => {
  it('blocks the save and names the field when a choice option is left blank', async () => {
    const { container, getByLabelText } = mount();

    const optionValue = getByLabelText('What are you into? choice 1 value') as HTMLInputElement;
    await fireEvent.update(optionValue, '');

    // Refused everywhere the save is offered, not merely rejected on submit.
    expect(saveButtons(container).length).toBeGreaterThan(0);
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);

    // And the operator is told WHICH question, not just that something failed.
    expect(alertText(container)).toContain('Interests');
    expect(alertText(container)).toContain('What are you into?');
    expect(alertText(container)).toMatch(/Choice 1 has no value/);
    expect(container.textContent).toContain('Fix the problems listed above before saving');
    expect(el(container, '#field-key-1-0').closest('.cpub-persona-field')?.className)
      .toContain('cpub-persona-field--invalid');
  });

  it('re-enables the save once the option value is filled in', async () => {
    const { container, getByLabelText } = mount();
    const optionValue = getByLabelText('What are you into? choice 1 value') as HTMLInputElement;

    await fireEvent.update(optionValue, '');
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);

    await fireEvent.update(optionValue, 'pcb_design');
    expect(saveButtons(container).some((b) => !b.disabled)).toBe(true);
    expect(alertText(container)).not.toContain('Choice 1');
  });

  it('keeps Zod’s own message when it is the informative one', async () => {
    // `interests` already exists in the other section: field keys are ONE
    // namespace, and the humanizer must not overwrite that message with a
    // character-set complaint about a key that is perfectly well formed.
    responseRef.value = makeResponse({ lockedKeys: [], rowCounts: {} });
    const { container } = mount();

    await fireEvent.update(el<HTMLInputElement>(container, '#field-key-0-1'), 'interests');

    expect(alertText(container)).toContain('Duplicate field key');
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);
  });

  it('names a malformed machine key in the operator’s words', async () => {
    responseRef.value = makeResponse({ lockedKeys: [], rowCounts: {} });
    const { container } = mount();

    await fireEvent.update(el<HTMLInputElement>(container, '#field-key-0-1'), 'Industry Sector');
    expect(alertText(container)).toContain('lowercase letters, numbers or underscores');
  });
});

describe('/admin/persona — machine keys are locked (plan 5.5)', () => {
  it('renaming a label does not change the machine key', async () => {
    const { container } = mount();

    const label = el<HTMLInputElement>(container, '#field-label-1-0');
    expect(label.value).toBe('What are you into?');
    expect(el<HTMLInputElement>(container, '#field-key-1-0').value).toBe('interests');

    await fireEvent.update(label, 'Which of these do you build?');

    expect(el<HTMLInputElement>(container, '#field-key-1-0').value).toBe('interests');
    // Nothing key-shaped was derived from the new label either.
    expect(el<HTMLInputElement>(container, '#field-key-1-0').value).not.toContain('which');
  });

  it('a label rename still saves the ORIGINAL key, so no rows are orphaned', async () => {
    const { container } = mount();
    await fireEvent.update(
      el<HTMLInputElement>(container, '#field-label-1-0'),
      'Which of these do you build?',
    );
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    const put = $fetch.mock.calls.find(
      (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
    );
    const body = (put![1] as { body: { sections: WireSection[]; removal: Record<string, string> } }).body;
    expect(body.sections[1]!.fields[0]!.key).toBe('interests');
    expect(body.sections[1]!.fields[0]!.label).toBe('Which of these do you build?');
    // Nothing dropped, so nothing to decide about.
    expect(body.removal).toEqual({});
  });

  it('renders a persisted key as read-only, with an explicit unlock', () => {
    const { container } = mount();
    expect(el<HTMLInputElement>(container, '#field-key-1-0').readOnly).toBe(true);
    expect(container.textContent).toContain('Locked.');
    expect(unlockButton(container, 1, 0).textContent).toContain('Change the key');
  });

  it('a key change confirmation names the orphan count', async () => {
    const { container } = mount();

    await fireEvent.click(unlockButton(container, 1, 0));

    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Change the machine key? This discards 412 stored answers.');

    // The key stays locked until the operator confirms.
    expect(el<HTMLInputElement>(container, '#field-key-1-0').readOnly).toBe(true);

    const confirm = [...dialog!.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('anyway')) as HTMLButtonElement;
    await fireEvent.click(confirm);
    expect(el<HTMLInputElement>(container, '#field-key-1-0').readOnly).toBe(false);
  });

  it('offers an equal-weight way to back out of the key change', async () => {
    const { container } = mount();
    await fireEvent.click(unlockButton(container, 1, 0));

    const buttons = [...container.querySelectorAll('[role="alertdialog"] button')] as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toContain('Keep the key');

    await fireEvent.click(buttons[0]!);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(el<HTMLInputElement>(container, '#field-key-1-0').readOnly).toBe(true);
  });

  it('says so honestly when the route reports no counts, instead of printing a zero', async () => {
    responseRef.value = makeResponse({ rowCounts: undefined });
    const { container } = mount();

    await fireEvent.click(unlockButton(container, 1, 0));
    const dialog = container.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain('Any answers already stored for this question are discarded.');
    expect(dialog?.textContent).not.toContain('0 stored answers');
  });

  it('uses the singular for a single stored answer', async () => {
    responseRef.value = makeResponse({ rowCounts: { interests: 1 } });
    const { container } = mount();
    await fireEvent.click(unlockButton(container, 1, 0));
    expect(container.querySelector('[role="alertdialog"]')?.textContent)
      .toContain('This discards 1 stored answer.');
  });

  it('a newly added question has an editable, empty key', async () => {
    const { container, getAllByText } = mount();
    await fireEvent.click(getAllByText(/Add question/)[0]!);

    const fresh = el<HTMLInputElement>(container, '#field-key-0-2');
    expect(fresh.readOnly).toBe(false);
    expect(fresh.value).toBe('');
    expect(container.querySelector('#field-key-help-0-2')?.textContent)
      .toContain('cannot be changed after saving');
  });

  it('a key change queues a purge decision for the orphaned key', async () => {
    const { container } = mount();

    await fireEvent.click(unlockButton(container, 1, 0));
    await fireEvent.click(
      [...container.querySelectorAll('[role="alertdialog"] button')]
        .find((b) => b.textContent?.includes('anyway')) as HTMLButtonElement,
    );
    await fireEvent.update(el<HTMLInputElement>(container, '#field-key-1-0'), 'making');

    expect(container.textContent).toContain('Removed questions');
    expect(el<HTMLInputElement>(container, 'input[name="removal-interests"][value="purge"]').checked)
      .toBe(true);
  });
});

describe('/admin/persona — removed questions need a decision before saving', () => {
  it('blocks the save until every dropped key is decided', async () => {
    const { container, getAllByText } = mount();

    await fireEvent.click(getAllByText(/Remove question/)[1]!); // Industry
    expect(container.textContent).toContain('Removed questions');
    expect(container.textContent).toContain('91 stored answers');
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);
    expect(container.textContent)
      .toContain('Choose what happens to the removed questions before saving');

    await fireEvent.click(el(container, 'input[name="removal-industry"][value="retain"]'));
    expect(saveButtons(container).some((b) => !b.disabled)).toBe(true);
  });

  it('sends the removal map with the save', async () => {
    const { container, getAllByText } = mount();
    await fireEvent.click(getAllByText(/Remove question/)[1]!);
    await fireEvent.click(el(container, 'input[name="removal-industry"][value="purge"]'));
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    const put = $fetch.mock.calls.find(
      (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
    );
    expect(put).toBeDefined();
    const body = (put![1] as { body: { sections: WireSection[]; removal: Record<string, string> } }).body;
    expect(body.removal).toEqual({ industry: 'purge' });
    expect(body.sections.flatMap((s) => s.fields).map((f) => f.key)).not.toContain('industry');
    expect(toast.success).toHaveBeenCalled();
  });
});

describe('/admin/persona — provenance and revert (plan 5.3.2)', () => {
  it('shows the override banner and reverts through DELETE', async () => {
    responseRef.value = makeResponse({
      source: 'database',
      db: clone(SECTIONS),
      savedAt: '2026-08-12T10:00:00.000Z',
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, getByText } = mount();

    expect(container.textContent).toContain(
      'This instance is using an admin edited persona schema. The version in commonpub.config.ts is not applied.',
    );

    await fireEvent.click(getByText(/Revert to the config file/));
    expect($fetch).toHaveBeenCalledWith('/api/admin/persona/schema', { method: 'DELETE' });
    confirmSpy.mockRestore();
  });

  it('renders no override banner when the config file is the source', () => {
    const { container } = mount();
    expect(container.textContent).not.toContain('is not applied');
    expect(
      [...container.querySelectorAll('.cpub-persona-badge')].map((b) => b.textContent?.trim()),
    ).toContain('from commonpub.config.ts');
  });

  it('marks which sections diverge from the config file while an override is live', () => {
    const diverged = clone(SECTIONS);
    diverged[1]!.label = 'Things you make';
    responseRef.value = makeResponse({
      source: 'database',
      db: diverged,
      effective: diverged,
      savedAt: '2026-08-12T10:00:00.000Z',
    });
    const { container } = mount();
    const badges = [...container.querySelectorAll('.cpub-persona-badge')].map((b) => b.textContent?.trim());
    expect(badges).toContain('matches commonpub.config.ts');
    expect(badges).toContain('overridden here');
  });

  it('marks an unsaved edit as unsaved rather than as provenance', async () => {
    const { container } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed');
    expect(
      [...container.querySelectorAll('.cpub-persona-badge')].map((b) => b.textContent?.trim()),
    ).toContain('Edited, not saved');
  });

  it('sends If-Match with the saved timestamp so a concurrent save conflicts', async () => {
    responseRef.value = makeResponse({
      source: 'database',
      db: clone(SECTIONS),
      savedAt: '2026-08-12T10:00:00.000Z',
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    const put = $fetch.mock.calls.find(
      (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
    );
    expect((put![1] as { headers: Record<string, string> }).headers['If-Match'])
      .toBe('2026-08-12T10:00:00.000Z');
  });
});

describe('/admin/persona — drift (plan 5.3.1)', () => {
  const DRIFT: WireDrift[] = [
    {
      kind: 'missing_field',
      fieldKey: 'old_interests',
      detail: 'No field in the schema uses this key',
      affectedRows: 37,
      acknowledgedAt: null,
    },
  ];

  it('renders the blocking banner with the exact plan copy', () => {
    responseRef.value = makeResponse({ drift: clone(DRIFT) });
    const { container } = mount();
    expect(container.textContent).toContain(
      'Some questions in the config file no longer match the answers already stored. Choose what to do with each before these questions are counted again.',
    );
    expect(container.textContent).toContain('37 stored answers');
    expect(container.textContent).toContain('old_interests');
  });

  it('offers Purge and Retain per field and posts the operator choice', async () => {
    responseRef.value = makeResponse({ drift: clone(DRIFT) });
    const { getByText } = mount();

    await fireEvent.click(getByText('Retain'));
    expect($fetch).toHaveBeenCalledWith('/api/admin/persona/drift/old_interests', {
      method: 'POST',
      body: { action: 'retain' },
    });

    await fireEvent.click(getByText('Purge'));
    expect($fetch).toHaveBeenCalledWith('/api/admin/persona/drift/old_interests', {
      method: 'POST',
      body: { action: 'purge' },
    });
  });

  it('hides an already acknowledged drift', () => {
    const acked = clone(DRIFT);
    acked[0]!.acknowledgedAt = '2026-08-11T00:00:00.000Z';
    responseRef.value = makeResponse({ drift: acked });
    const { container } = mount();
    expect(container.textContent).not.toContain('no longer match the answers already stored');
  });
});

describe('/admin/persona — keyboard reorder', () => {
  it('moves a section with edge-disabled buttons and announces the new position', async () => {
    const { container, getByLabelText } = mount();

    expect((getByLabelText('Move section Basics up') as HTMLButtonElement).disabled).toBe(true);
    const down = getByLabelText('Move section Basics down') as HTMLButtonElement;
    expect(down.disabled).toBe(false);

    await fireEvent.click(down);

    expect(container.querySelector('[aria-live="polite"]')?.textContent)
      .toBe('Moved section "Basics" to position 2 of 2.');
    expect((getByLabelText('Move section Basics down') as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves a question inside its section and announces its position', async () => {
    const { container, getByLabelText } = mount();
    expect((getByLabelText('Move Display name up') as HTMLButtonElement).disabled).toBe(true);

    await fireEvent.click(getByLabelText('Move Display name down'));

    expect(container.querySelector('[aria-live="polite"]')?.textContent)
      .toBe('Moved "Display name" to position 2 of 2.');
    expect(el<HTMLInputElement>(container, '#field-key-0-0').value).toBe('industry');
  });

  it('announces politely, never assertively', () => {
    const { container } = mount();
    expect(container.querySelector('[aria-live="assertive"]')).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('reorder is available without a pointer: every control is a real button', () => {
    const { getByLabelText } = mount();
    for (const label of [
      'Move section Basics up',
      'Move section Basics down',
      'Move Display name up',
      'Move Display name down',
    ]) {
      expect(getByLabelText(label).tagName).toBe('BUTTON');
    }
  });
});

describe('/admin/persona — type picker is registry driven', () => {
  it('groups every persona field type, and only persona types', () => {
    const { container } = mount();
    const select = el<HTMLSelectElement>(container, '#field-type-1-0');

    expect([...select.querySelectorAll('optgroup')].map((g) => g.getAttribute('label')))
      .toEqual(['Basic', 'Choice', 'Profile links', 'Layout']);

    const values = [...select.querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual([
      'text', 'textarea', 'url', 'number', 'date',
      'select', 'radio', 'checkbox', 'multiselect',
      'link', 'section',
    ]);
    // Contest form types must not leak into a persona template (section 14.4).
    for (const contestOnly of ['email', 'file', 'agreement', 'address', 'signature', 'tel']) {
      expect(values).not.toContain(contestOnly);
    }
  });

  it('drops properties the new type cannot carry, so the strict schema still passes', async () => {
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');

    expect(container.querySelector('#field-maxsel-1-0')).toBeNull();
    expect(alertText(container)).toBe('');
    expect(saveButtons(container).some((b) => !b.disabled)).toBe(true);
  });

  it('seeds a usable option when switching to a choice type', async () => {
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-0-0'), 'radio');

    expect(alertText(container)).toBe('');
    expect(saveButtons(container).some((b) => !b.disabled)).toBe(true);
  });

  it('says whether an answer can ever be counted', () => {
    const { container } = mount();
    expect(el(container, '#field-type-help-1-0').textContent).toContain('Counted in statistics');
    // A column-bound field lives on the users row and is never a bucket.
    expect(el(container, '#field-type-help-0-0').textContent).toContain('Never counted');
  });
});

describe('/admin/persona — export for commonpub.config.ts', () => {
  it('emits a paste-able TypeScript literal, not JSON', async () => {
    const { container, getByText } = mount();
    await fireEvent.click(getByText(/Export for commonpub.config.ts/));

    const text = el<HTMLTextAreaElement>(container, '.cpub-persona-export-text').value;
    expect(text).toContain("import { definePersonaSections } from '@commonpub/persona';");
    expect(text).toContain('sections: definePersonaSections([');
    expect(text).toContain("key: 'basics'");
    expect(text).toContain("label: 'Basics'");
    // Identifier keys unquoted, strings single-quoted: this is source, not JSON.
    expect(text).not.toContain('"key"');
  });

  it('exports the DRAFT, so the operator commits what they are looking at', async () => {
    const { container, getByText } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed question');
    await fireEvent.click(getByText(/Export for commonpub.config.ts/));

    expect(el<HTMLTextAreaElement>(container, '.cpub-persona-export-text').value)
      .toContain("label: 'Renamed question'");
  });
});

describe('/admin/persona — what the server refuses (PUT 409 and 400)', () => {
  it('a plain save is never a force save', async () => {
    // `@click="save"` would hand the MouseEvent to the `force` parameter and
    // silently turn every save into a destructive one.
    const { container } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    expect(putCall()![0]).toBe('/api/admin/persona/schema');
    expect(putCall()![0]).not.toContain('force');
  });

  it('renders every destructive blocker with its own row count', async () => {
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_DESTRUCTIVE',
      blockers: [
        {
          fieldKey: 'interests',
          kind: 'type_changed',
          detail: 'Changing the type of "What are you into?" from multiselect to text discards 412 stored answers.',
          affectedRows: 412,
          requires: 'force',
        },
      ],
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    expect(alertText(container)).toContain('This save would discard stored answers');
    expect(alertText(container)).toContain('discards 412 stored answers');
    expect(toast.error).toHaveBeenCalled();
  });

  it('the force retry is explicit, separate, and marked destructive', async () => {
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_DESTRUCTIVE',
      blockers: [
        {
          fieldKey: 'interests',
          kind: 'type_changed',
          detail: 'Changing the type discards 412 stored answers.',
          affectedRows: 412,
          requires: 'force',
        },
      ],
    });
    const { container, getByText } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    const force = getByText('Save anyway and discard them') as HTMLButtonElement;
    expect(force.className).toContain('cpub-persona-danger');
    await fireEvent.click(force);

    const forced = $fetch.mock.calls.filter(
      (c) => (c[1] as { method?: string } | undefined)?.method === 'PUT',
    );
    expect(forced).toHaveLength(2);
    expect(forced[1]![0]).toBe('/api/admin/persona/schema?force=true');
  });

  it('learns the row count from the refusal, so the next unlock names it', async () => {
    // The GET does not report counts today. The 409 does, and a count is a fact
    // about stored data rather than about the draft, so it survives the edit.
    responseRef.value = makeResponse({ rowCounts: undefined });
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_DESTRUCTIVE',
      blockers: [
        {
          fieldKey: 'interests',
          kind: 'type_changed',
          detail: 'Changing the type discards 412 stored answers.',
          affectedRows: 412,
          requires: 'force',
        },
      ],
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    await fireEvent.click(unlockButton(container, 1, 0));
    expect(container.querySelector('[role="alertdialog"]')?.textContent)
      .toContain('This discards 412 stored answers.');
  });

  it('a sink change still in the template gets a purge or retain control', async () => {
    // The field has NOT been dropped, so a removal panel derived from the
    // dropped keys alone would leave the operator with no way to answer.
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_DESTRUCTIVE',
      blockers: [
        {
          fieldKey: 'interests',
          kind: 'sink_changed',
          detail: 'Its 412 stored rows do not move with it.',
          affectedRows: 412,
          requires: 'removal',
        },
      ],
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    expect(container.querySelector('input[name="removal-interests"][value="purge"]')).not.toBeNull();
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);
  });

  it('shows both timestamps on a concurrency conflict', async () => {
    responseRef.value = makeResponse({
      source: 'database',
      db: clone(SECTIONS),
      savedAt: '2026-08-12T10:00:00.000Z',
    });
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_CONFLICT',
      clientSavedAt: '2026-08-12T10:00:00.000Z',
      serverSavedAt: '2026-08-12T11:30:00.000Z',
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    expect(alertText(container)).toContain('Someone else saved this schema while you were editing.');
    expect(alertText(container)).toContain('2026-08-12T11:30:00.000Z');
  });

  it('names the field a server-only rule rejected', async () => {
    putError = h3Error(400, {
      code: 'PERSONA_SCHEMA_INVALID',
      fieldErrors: [
        {
          sectionIndex: 1,
          sectionKey: 'interests',
          fieldIndex: 0,
          fieldKey: 'interests',
          path: [1, 'fields', 0, 'platform'],
          message: 'Unknown link platform: gitlab',
        },
      ],
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Renamed');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);

    expect(alertText(container)).toContain('interests / interests');
    expect(alertText(container)).toContain('Unknown link platform: gitlab');
  });

  it('clears a stale refusal as soon as the draft changes', async () => {
    putError = h3Error(409, {
      code: 'PERSONA_SCHEMA_DESTRUCTIVE',
      blockers: [
        {
          fieldKey: 'interests',
          kind: 'type_changed',
          detail: 'Changing the type discards 412 stored answers.',
          affectedRows: 412,
          requires: 'force',
        },
      ],
    });
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-1-0'), 'text');
    await fireEvent.click(saveButtons(container).find((b) => !b.disabled)!);
    expect(alertText(container)).toContain('This save would discard stored answers');

    await fireEvent.update(el<HTMLInputElement>(container, '#field-label-1-0'), 'Something else');
    expect(alertText(container)).not.toContain('This save would discard stored answers');
  });
});

describe('/admin/persona — link platforms and retained data', () => {
  it('offers exactly the platform set the route resolved, without re-merging it', () => {
    responseRef.value = makeResponse({
      platforms: [{ key: 'github', label: 'GitHub' }, { key: 'forgejo', label: 'Forgejo' }],
    });
    const { container } = mount();
    // Turn one field into a link so the platform picker renders.
    return fireEvent.update(el<HTMLSelectElement>(container, '#field-type-0-0'), 'link').then(() => {
      const options = [...el<HTMLSelectElement>(container, '#field-platform-0-0')
        .querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value);
      expect(options).toEqual(['github', 'forgejo']);
    });
  });

  it('falls back to the built-in platforms when the route omits them', async () => {
    const { container } = mount();
    await fireEvent.update(el<HTMLSelectElement>(container, '#field-type-0-0'), 'link');
    const options = [...el<HTMLSelectElement>(container, '#field-platform-0-0')
      .querySelectorAll('option')].map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain('github');
    expect(options).toContain('mastodon');
    // Deferred with the normalized links table (section 14.4).
    expect(options).not.toContain('gitlab');
  });

  it('lists data kept from questions that already left the schema', () => {
    responseRef.value = makeResponse({
      retired: [{ fieldKey: 'old_interests', retiredAt: '2026-08-01T00:00:00.000Z' }],
    });
    const { container } = mount();
    expect(container.textContent).toContain('Data kept from removed questions');
    expect(container.textContent).toContain('old_interests');
    expect(container.textContent).toContain('never counted in statistics');
  });
});

describe('/admin/persona — gating, permissions and empty states', () => {
  it('renders nothing but a pointer at the flag when persona is off', () => {
    personaFlag.value = false;
    const { container } = mount();
    expect(container.textContent).toContain('The persona schema is not enabled on this instance.');
    expect(container.querySelector('.cpub-persona-section')).toBeNull();
  });

  it('offers no write control to someone without settings.manage', () => {
    canManage.value = false;
    const { container, getAllByText } = mount();
    expect((getAllByText(/Add question/)[0] as HTMLButtonElement).disabled).toBe(true);
    expect(saveButtons(container).every((b) => b.disabled)).toBe(true);
  });

  it('offers to start a schema when there are no sections', () => {
    responseRef.value = makeResponse({ effective: [], file: [], source: 'builtin' });
    const { container } = mount();
    expect(container.textContent).toContain('No sections yet.');
  });

  it('surfaces a malformed commonpub.config.ts instead of silently serving built-ins', () => {
    responseRef.value = makeResponse({ fileError: 'Invalid persona config at sections.0.key' });
    const { container } = mount();
    expect(container.textContent).toContain('commonpub.config.ts could not be read');
    expect(container.textContent).toContain('Invalid persona config at sections.0.key');
  });

  it('uses no em dash in any rendered copy', () => {
    const { container } = mount();
    expect(container.textContent ?? '').not.toContain('—');
  });
});
