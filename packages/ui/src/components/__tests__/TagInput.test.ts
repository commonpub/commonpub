import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import TagInput from '../TagInput.vue';

describe('TagInput', () => {
  it('renders existing tags', () => {
    render(TagInput, {
      props: { modelValue: ['vue', 'typescript'] },
    });
    expect(screen.getByText('vue')).toBeTruthy();
    expect(screen.getByText('typescript')).toBeTruthy();
  });

  it('renders remove buttons with aria-label for each tag', () => {
    render(TagInput, {
      props: { modelValue: ['react', 'svelte'] },
    });
    expect(screen.getByRole('button', { name: 'Remove react' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove svelte' })).toBeTruthy();
  });

  it('renders an input element', () => {
    render(TagInput);
    const input = screen.getByPlaceholderText('Type and press Enter');
    expect(input).toBeTruthy();
    expect(input.tagName).toBe('INPUT');
  });

  it('emits update:modelValue with new tag on Enter', async () => {
    const { emitted } = render(TagInput, {
      props: { modelValue: ['existing'] },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.update(input, 'newtag');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(emitted()['update:modelValue'][0]).toEqual([['existing', 'newtag']]);
  });

  it('does not add duplicate tags', async () => {
    const { emitted } = render(TagInput, {
      props: { modelValue: ['existing'] },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.update(input, 'existing');
    await fireEvent.keyDown(input, { key: 'Enter' });
    // Should not emit since it's a duplicate
    expect(emitted()['update:modelValue']).toBeFalsy();
  });

  it('does not add empty tags', async () => {
    const { emitted } = render(TagInput, {
      props: { modelValue: [] },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(emitted()['update:modelValue']).toBeFalsy();
  });

  it('emits update:modelValue without tag on remove button click', async () => {
    const { emitted } = render(TagInput, {
      props: { modelValue: ['vue', 'react'] },
    });
    const removeBtn = screen.getByRole('button', { name: 'Remove vue' });
    await fireEvent.click(removeBtn);
    expect(emitted()['update:modelValue'][0]).toEqual([['react']]);
  });

  it('removes last tag on Backspace when input is empty', async () => {
    const { emitted } = render(TagInput, {
      props: { modelValue: ['vue', 'react'] },
    });
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await fireEvent.keyDown(input, { key: 'Backspace' });
    expect(emitted()['update:modelValue'][0]).toEqual([['vue']]);
  });

  it('shows placeholder when no tags exist', () => {
    render(TagInput, {
      props: { modelValue: [], placeholder: 'Add tags...' },
    });
    expect(screen.getByPlaceholderText('Add tags...')).toBeTruthy();
  });
});
