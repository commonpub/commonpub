import type { Ref } from 'vue';

/**
 * Publish an element's measured height as a CSS custom property on `<html>`.
 *
 * Two fixed bars now dock to the bottom of the viewport (the cookie consent
 * banner and the contest action bar) and each needs the other to know how tall
 * it is: the page reserves the action bar's height so it never covers the
 * footer, and the action bar sits above the consent banner rather than under
 * it. Both were doing the same ResizeObserver dance inline.
 *
 * Measured rather than assumed on purpose. A hardcoded height was wrong by 25px
 * on the first device tested, because the real value moves with the safe-area
 * inset, the font scale and whether the labels wrap.
 *
 * Watches the REF rather than measuring in `onMounted`: both consumers sit
 * behind a `v-if`, so the element frequently does not exist at mount and
 * appears later (an accepted judge only learns they can judge after a lazy
 * fetch resolves). An onMounted-only observer silently never attaches, and the
 * dependent layout then falls back to a default that is wrong.
 */
export function usePublishedHeight(el: Ref<HTMLElement | null>, cssVar: string): void {
  // SSR has no layout to measure and no document to write to.
  if (typeof window === 'undefined') return;

  let observer: ResizeObserver | null = null;

  function clear(): void {
    document.documentElement.style.removeProperty(cssVar);
  }

  function publish(height: number): void {
    // A zero height means the element is display:none (the bars are hidden
    // above their breakpoint). Clearing rather than writing 0 lets the
    // consumer's own fallback apply.
    if (height > 0) document.documentElement.style.setProperty(cssVar, `${Math.ceil(height)}px`);
    else clear();
  }

  watch(
    el,
    (node) => {
      observer?.disconnect();
      observer = null;
      if (!node || typeof ResizeObserver === 'undefined') {
        clear();
        return;
      }
      observer = new ResizeObserver(([entry]) => publish(entry.target.getBoundingClientRect().height));
      observer.observe(node);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
    clear();
  });
}
