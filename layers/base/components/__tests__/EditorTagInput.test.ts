/**
 * Tests for the tag input's server-contract caps.
 *
 * Lives in the layer (not packages/editor) because the layer is where
 * @testing-library/vue is available; the component is imported through its
 * public entry point, which is how consumers actually get it.
 *
 * Untested until session 251, which is how it shipped with no length or count
 * limit against `tags: z.array(z.string().max(64)).max(20)`. Paste fires no
 * `keydown`, so pasting "a, b, c, …" and pressing Enter produced ONE over-long
 * tag that then 400'd every subsequent save, with no UI hint that a limit existed.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/vue';
import { EditorTagInput } from '@commonpub/editor/vue';

const TAG_MAX_LEN = 64;
const TAG_MAX_COUNT = 20;

function mount(tags: string[] = []) {
  return render(EditorTagInput, { props: { tags } });
}
const input = (c: Element) => c.querySelector('.cpub-tag-input') as HTMLInputElement;
const lastEmit = (emitted: () => Record<string, unknown[]>): string[] | undefined => {
  const ev = emitted()['update:tags'] as unknown[][] | undefined;
  return ev ? (ev[ev.length - 1]![0] as string[]) : undefined;
};

describe('EditorTagInput — server caps', () => {
  it('splits a PASTED comma list into separate tags (not one long tag)', async () => {
    const { container, emitted } = mount([]);
    const el = input(container);
    // A paste sets the whole value at once; only the subsequent Enter is a keydown.
    await fireEvent.update(el, 'solar, battery, off-grid, arduino, esp32, resilience, disaster-relief');
    await fireEvent.keyDown(el, { key: 'Enter' });

    const tags = lastEmit(emitted)!;
    expect(tags).toEqual(['solar', 'battery', 'off-grid', 'arduino', 'esp32', 'resilience', 'disaster-relief']);
    for (const t of tags) expect(t.length).toBeLessThanOrEqual(TAG_MAX_LEN);
  });

  it('truncates an over-long tag to the server cap instead of sending a 400', async () => {
    const { container, emitted } = mount([]);
    const el = input(container);
    await fireEvent.update(el, 'x'.repeat(120));
    await fireEvent.keyDown(el, { key: 'Enter' });
    const tags = lastEmit(emitted)!;
    expect(tags).toHaveLength(1);
    expect(tags[0]).toHaveLength(TAG_MAX_LEN);
  });

  it('never exceeds the 20-tag cap', async () => {
    const existing = Array.from({ length: 18 }, (_, i) => `t${i}`);
    const { container, emitted } = mount(existing);
    const el = input(container);
    await fireEvent.update(el, 'a, b, c, d, e');
    await fireEvent.keyDown(el, { key: 'Enter' });
    const tags = lastEmit(emitted)!;
    expect(tags).toHaveLength(TAG_MAX_COUNT);
    expect(tags.slice(0, 18)).toEqual(existing);
  });

  it('drops duplicates and blanks rather than emitting them', async () => {
    const { container, emitted } = mount(['solar']);
    const el = input(container);
    await fireEvent.update(el, 'solar, , battery,   , solar');
    await fireEvent.keyDown(el, { key: 'Enter' });
    expect(lastEmit(emitted)).toEqual(['solar', 'battery']);
  });

  it('commits on blur too, so a typed tag is not silently lost', async () => {
    const { container, emitted } = mount([]);
    const el = input(container);
    await fireEvent.update(el, 'lithium');
    await fireEvent.blur(el);
    expect(lastEmit(emitted)).toEqual(['lithium']);
  });

  it('shows the count and disables input at the limit', async () => {
    const { container: under } = mount(['a', 'b']);
    expect(under.querySelector('.cpub-tag-count')?.textContent).toContain(`2/${TAG_MAX_COUNT}`);
    expect(input(under).disabled).toBe(false);

    const { container: full } = mount(Array.from({ length: TAG_MAX_COUNT }, (_, i) => `t${i}`));
    expect(input(full).disabled).toBe(true);
    expect(input(full).placeholder).toMatch(/limit/i);
  });

  it('emits nothing when there is nothing new to add', async () => {
    const { container, emitted } = mount(['solar']);
    const el = input(container);
    await fireEvent.update(el, '   ');
    await fireEvent.keyDown(el, { key: 'Enter' });
    expect(emitted()['update:tags']).toBeUndefined();
    expect(el.value).toBe('');
  });

  it('removes a tag by index', async () => {
    const { container, emitted } = mount(['a', 'b', 'c']);
    const removes = container.querySelectorAll('.cpub-tag-remove');
    await fireEvent.click(removes[1]!);
    expect(lastEmit(emitted)).toEqual(['a', 'c']);
  });
});
