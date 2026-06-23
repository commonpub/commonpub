/**
 * useScrollSpy — TOC scroll-spy (active-heading highlight) + smooth scroll.
 *
 * Consolidates two divergent, each-buggy copies of the same IntersectionObserver
 * pattern: ProjectView.vue (which never re-observed, so the highlight went stale
 * when content changed) and the docs viewer (which re-observed but leaked an
 * observer every time because its instance was function-local and never
 * disconnected). This single source:
 *   - re-observes whenever `source` changes (fixes the stale highlight), and
 *   - disconnects the previous observer before each re-observe and on unmount
 *     (fixes the leak).
 *
 * Element discovery and `rootMargin` stay per-surface (one finds elements by TOC
 * id, the other by CSS selector; the active band differs), so callers pass those
 * in. `scrollTo` honours prefers-reduced-motion (the docs viewer uses native
 * anchor links instead and simply ignores it).
 */
import { onMounted, onUnmounted, ref, watch, nextTick, type Ref, type WatchSource } from 'vue';

export interface UseScrollSpyOptions {
  /** Resolve the heading elements to observe. Called on mount + on each `source` change. */
  getHeadingElements: () => HTMLElement[];
  /** Reactive trigger; when it changes, the observer is rebuilt (e.g. the TOC array or rendered page). */
  source: WatchSource;
  /** IntersectionObserver rootMargin — the active band, tuned per surface. */
  rootMargin?: string;
}

export interface UseScrollSpy {
  /** Id of the heading currently in the active band (or set by scrollTo). */
  activeId: Ref<string>;
  /** Smooth-scroll to a heading by id and mark it active (honours reduced-motion). */
  scrollTo: (id: string) => void;
}

const DEFAULT_ROOT_MARGIN = '-80px 0px -70% 0px';

export function useScrollSpy(options: UseScrollSpyOptions): UseScrollSpy {
  const activeId = ref('');
  let observer: IntersectionObserver | null = null;

  function observe(): void {
    if (typeof IntersectionObserver === 'undefined') return; // SSR / unsupported
    observer?.disconnect(); // never leak the previous observer
    const els = options.getHeadingElements();
    if (!els.length) {
      observer = null;
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        // Topmost heading in the band wins (entries arrive in document order).
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId.value = entry.target.id;
            break;
          }
        }
      },
      { rootMargin: options.rootMargin ?? DEFAULT_ROOT_MARGIN, threshold: 0 },
    );
    for (const el of els) observer.observe(el);
  }

  function scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    // CSS scroll-behavior is reduced-motion-gated, but the JS `smooth` option
    // ignores that, so honour the preference explicitly.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    activeId.value = id;
  }

  let stopWatch: (() => void) | null = null;
  onMounted(() => {
    // immediate → initial observe after first paint; subsequent → re-observe on change.
    stopWatch = watch(options.source, () => nextTick(observe), { immediate: true });
  });
  onUnmounted(() => {
    stopWatch?.();
    observer?.disconnect();
    observer = null;
  });

  return { activeId, scrollTo };
}
