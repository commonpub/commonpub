/**
 * The height-publishing contract, which two fixed bottom bars depend on: the
 * contest page reserves the action bar's height so it never covers the footer,
 * and the action bar sits above the cookie banner rather than under it.
 *
 * Nothing covered this before. The bug it exists to prevent is silent: an
 * observer that never attaches leaves the dependent layout on a hardcoded
 * fallback that was measured wrong by 25px, and the only symptom is a bar
 * sitting on top of the page footer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import { usePublishedHeight } from '../usePublishedHeight';

// jsdom has no layout engine and no ResizeObserver: drive both by hand.
let observed: Element[] = [];
let disconnects = 0;
let trigger: (() => void) | null = null;
let height = 0;

class FakeResizeObserver {
  constructor(private cb: (entries: { target: Element }[]) => void) {
    trigger = () => this.cb(observed.map((target) => ({ target })));
  }
  observe(el: Element) { observed.push(el); trigger?.(); }
  disconnect() { disconnects++; observed = []; }
}

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ height } as DOMRect);
  return el;
}

const VAR = '--cpub-test-h';
const read = () => document.documentElement.style.getPropertyValue(VAR);

beforeEach(() => {
  observed = []; disconnects = 0; trigger = null; height = 86;
  document.documentElement.style.removeProperty(VAR);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

describe('usePublishedHeight', () => {
  it('publishes the measured height once the element exists', async () => {
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    expect(read(), 'nothing to measure yet').toBe('');

    el.value = makeEl();
    await nextTick();
    expect(read()).toBe('86px');
  });

  it('attaches when the element appears LATER, not only at mount', async () => {
    // The failing case this was written for: both consumers sit behind a v-if,
    // and an accepted judge only learns they can judge after a lazy fetch
    // resolves. An onMounted-only observer never attaches for them.
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    await nextTick();
    el.value = makeEl();
    await nextTick();
    expect(read()).toBe('86px');
  });

  it('re-attaches across a false -> true -> false -> true flip without leaking observers', async () => {
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    el.value = makeEl();
    await nextTick();
    el.value = null;
    await nextTick();
    expect(read(), 'clears when the element goes away').toBe('');
    const second = makeEl();
    el.value = second;
    await nextTick();
    expect(read()).toBe('86px');
    // The property that matters is that the OLD observer is gone, not how many
    // times disconnect was called: only the current element is still observed.
    expect(observed).toEqual([second]);
    expect(disconnects).toBeGreaterThanOrEqual(1);
  });

  it('rounds up, so a fractional height never under-reserves', async () => {
    height = 85.2;
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    el.value = makeEl();
    await nextTick();
    expect(read()).toBe('86px');
  });

  it('clears rather than publishing 0 when the element is hidden', async () => {
    // The bars are display:none above their breakpoint. Writing 0px would
    // override the consumer's own fallback; clearing lets it apply.
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    el.value = makeEl();
    await nextTick();
    expect(read()).toBe('86px');

    height = 0;
    trigger?.();
    expect(read()).toBe('');
  });

  it('does nothing when ResizeObserver is unavailable', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const el = ref<HTMLElement | null>(null);
    usePublishedHeight(el, VAR);
    el.value = makeEl();
    await nextTick();
    expect(read()).toBe('');
  });
});
