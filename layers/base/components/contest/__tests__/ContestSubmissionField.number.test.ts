/**
 * Regression tests for the ONE field type that broke every contest form.
 *
 * Vue's `v-model` on `<input type="number">` casts the value to a NUMBER. This
 * component's model — and the wire contract (`fields: Record<string, string>`) —
 * is a STRING. The coerced value then hit `.trim()` in the shared helpers, threw
 * a TypeError inside a computed, and took the whole form down: Save stuck
 * disabled, answers silently dropped, nothing submittable. Registration,
 * proposal and stage-submission forms all share that path.
 *
 * These assert the emitted MODEL VALUE, which is what actually reaches the
 * server — not that the input merely rendered.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { ref } from 'vue';
import ContestSubmissionField from '../ContestSubmissionField.vue';
import type { ContestSubmissionTemplateField } from '@commonpub/schema';
import { buildSubmissionPayload, isFieldFilled } from '../../../utils/contestSubmission';

Object.assign(globalThis, {
  useFeatures: () => ({ features: ref({ contestPrivateFiles: false }) }),
  useFileUpload: () => ({ uploadFile: async () => ({ id: 'f1', url: '/x', originalName: 'f' }) }),
});

function mountField(field: ContestSubmissionTemplateField, modelValue = '') {
  return render(ContestSubmissionField, { props: { field, idPrefix: 'p', modelValue } });
}

const numberField: ContestSubmissionTemplateField = {
  key: 'size', label: 'Team size', type: 'number', required: true,
} as ContestSubmissionTemplateField;

describe('ContestSubmissionField — number keeps the string wire shape', () => {
  it('emits a STRING, not a number, when a value is typed', async () => {
    const { container, emitted } = mountField(numberField);
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input, 'number field should render a number input').toBeTruthy();

    await fireEvent.update(input, '4');

    const events = emitted()['update:modelValue'] as unknown[][];
    expect(events, 'typing must emit a model update').toBeTruthy();
    const emittedValue = events[events.length - 1]![0];
    expect(emittedValue).toBe('4');
    expect(typeof emittedValue).toBe('string');
  });

  it('the emitted value flows through the shared helpers without throwing', async () => {
    const { container, emitted } = mountField(numberField);
    await fireEvent.update(container.querySelector('input[type="number"]') as HTMLInputElement, '12');
    const value = (emitted()['update:modelValue'] as unknown[][]).at(-1)![0] as string;

    // This is the exact call chain that used to throw and kill the form.
    expect(() => buildSubmissionPayload([numberField], { size: value })).not.toThrow();
    expect(buildSubmissionPayload([numberField], { size: value })).toEqual({ size: '12' });
    expect(isFieldFilled(numberField, value)).toBe(true);
  });

  it('an emptied number field reads as unfilled (so `required` still blocks)', async () => {
    const { container, emitted } = mountField(numberField, '7');
    await fireEvent.update(container.querySelector('input[type="number"]') as HTMLInputElement, '');
    const value = (emitted()['update:modelValue'] as unknown[][]).at(-1)![0] as string;
    expect(value).toBe('');
    expect(isFieldFilled(numberField, value)).toBe(false);
    expect(buildSubmissionPayload([numberField], { size: value })).toEqual({});
  });

  it('text-ish types still round-trip strings unchanged', async () => {
    // Type-appropriate values: a date input silently rejects a non-date, so a
    // shared 'abc' would prove nothing about the binding.
    const cases: Array<[ContestSubmissionTemplateField['type'], string]> = [
      ['text', 'abc'],
      ['url', 'https://example.com/x'],
      ['email', 'a@b.io'],
      ['tel', '+15555550123'],
      ['date', '2030-01-02'],
    ];
    for (const [type, value] of cases) {
      const f = { key: 'k', label: 'K', type, required: false } as ContestSubmissionTemplateField;
      const { container, emitted } = mountField(f);
      const input = container.querySelector('input') as HTMLInputElement;
      await fireEvent.update(input, value);
      const events = emitted()['update:modelValue'] as unknown[][] | undefined;
      expect(events, `${type} must emit a model update`).toBeTruthy();
      const v = events!.at(-1)![0];
      expect(typeof v, `${type} must stay a string`).toBe('string');
      expect(v).toBe(value);
    }
  });

  it('an agreement checkbox emits the string marker the server expects', async () => {
    const f = {
      key: 'tos', label: 'Terms', type: 'agreement', required: true, mustAccept: true, terms: 'Rules.',
    } as ContestSubmissionTemplateField;
    const { container, emitted } = mountField(f);
    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await fireEvent.click(box);
    const v = (emitted()['update:modelValue'] as unknown[][]).at(-1)![0];
    expect(v).toBe('true');
    expect(typeof v).toBe('string');
    expect(isFieldFilled(f, v as string)).toBe(true);
  });
});
