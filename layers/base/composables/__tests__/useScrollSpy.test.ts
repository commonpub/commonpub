/**
 * Tests for useScrollSpy — the shared TOC scroll-spy extracted from ProjectView
 * and the docs viewer.
 *
 * onMounted/onUnmounted need a real component instance, so the composable is
 * hosted in a tiny test component (same pattern as useEditorAutosave.test.ts).
 * IntersectionObserver is replaced with a controllable mock (the global no-op
 * shim from test-setup is overridden here so we can drive the callback and
 * assert observe/disconnect).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { render } from '@testing-library/vue';
import { useScrollSpy, type UseScrollSpy, type UseScrollSpyOptions } from '../useScrollSpy';

class MockIO {
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    instances.push(this);
  }
  observe(el: Element): void { this.observed.push(el); }
  unobserve(el: Element): void { this.observed = this.observed.filter((e) => e !== el); }
  disconnect(): void { this.disconnected = true; this.observed = []; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
  /** Drive the observer callback from a test. */
  fire(entries: Array<{ target: Element; isIntersecting: boolean }>): void {
    this.callback(entries as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

let instances: MockIO[] = [];

function makeHeading(id: string): HTMLElement {
  const el = document.createElement('h2');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

function mountSpy(opts: UseScrollSpyOptions): { api: UseScrollSpy; unmount: () => void } {
  let api!: UseScrollSpy;
  const host = render(
    defineComponent({
      setup() {
        api = useScrollSpy(opts);
        return () => h('div');
      },
    }),
  );
  return { api, unmount: host.unmount };
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal('IntersectionObserver', MockIO);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    // jsdom defines matchMedia on window, not the bare global — set both.
    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('observes each heading element on mount', async () => {
    const headings = [makeHeading('a'), makeHeading('b')];
    mountSpy({ source: () => 0, getHeadingElements: () => headings });
    await nextTick();

    expect(instances).toHaveLength(1);
    expect(instances[0]!.observed).toEqual(headings);
  });

  it('re-observes and disconnects the previous observer when source changes (no leak)', async () => {
    const source = ref(0);
    const headings = [makeHeading('a'), makeHeading('b')];
    mountSpy({ source: () => source.value, getHeadingElements: () => headings });
    await nextTick();
    expect(instances).toHaveLength(1);

    source.value = 1;
    await nextTick(); // flush the watcher (schedules nextTick(observe))
    await nextTick(); // flush observe

    expect(instances).toHaveLength(2);
    expect(instances[0]!.disconnected).toBe(true); // old observer torn down
    expect(instances[1]!.observed).toEqual(headings);
  });

  it('sets activeId to the first intersecting heading (skipping non-intersecting)', async () => {
    const a = makeHeading('a');
    const b = makeHeading('b');
    const { api } = mountSpy({ source: () => 0, getHeadingElements: () => [a, b] });
    await nextTick();

    instances[0]!.fire([
      { target: a, isIntersecting: false },
      { target: b, isIntersecting: true },
    ]);
    expect(api.activeId.value).toBe('b');
  });

  it('scrollTo scrolls to the element and marks it active', async () => {
    const a = makeHeading('a');
    a.scrollIntoView = vi.fn();
    const { api } = mountSpy({ source: () => 0, getHeadingElements: () => [a] });
    await nextTick();

    api.scrollTo('a');
    expect(a.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(api.activeId.value).toBe('a');
  });

  it('scrollTo honours prefers-reduced-motion', async () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = vi.fn().mockReturnValue({ matches: true });
    const a = makeHeading('a');
    a.scrollIntoView = vi.fn();
    const { api } = mountSpy({ source: () => 0, getHeadingElements: () => [a] });
    await nextTick();

    api.scrollTo('a');
    expect(a.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('disconnects the observer on unmount', async () => {
    const { unmount } = mountSpy({ source: () => 0, getHeadingElements: () => [makeHeading('a')] });
    await nextTick();
    expect(instances).toHaveLength(1);

    unmount();
    expect(instances[0]!.disconnected).toBe(true);
  });

  it('creates no observer when there are no headings', async () => {
    const { api } = mountSpy({ source: () => 0, getHeadingElements: () => [] });
    await nextTick();

    expect(instances).toHaveLength(0);
    expect(api.activeId.value).toBe('');
  });
});
