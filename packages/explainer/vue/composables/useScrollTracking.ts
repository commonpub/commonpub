import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';

export interface ScrollTrackingOptions {
  /** Root element to observe within (default: viewport) */
  root?: Ref<HTMLElement | null>;
  /** Root margin for intersection detection */
  rootMargin?: string;
}

export function useScrollTracking(
  sectionIds: Ref<string[]>,
  options: ScrollTrackingOptions = {},
) {
  const activeSectionId = ref<string>('');
  const activeSectionIndex = ref(0);
  const scrollProgress = ref(0);
  const sectionVisibility = ref<Map<string, number>>(new Map());

  let observer: IntersectionObserver | null = null;
  let scrollHandler: (() => void) | null = null;

  function updateProgress(): void {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress.value = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
  }

  function setup(): void {
    // Scroll progress tracking
    scrollHandler = updateProgress;
    window.addEventListener('scroll', scrollHandler, { passive: true });
    updateProgress();

    // Section visibility tracking via IntersectionObserver
    observer = new IntersectionObserver(
      (entries) => {
        const visMap = new Map(sectionVisibility.value);

        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (!id) continue;
          visMap.set(id, entry.intersectionRatio);
        }

        sectionVisibility.value = visMap;

        // Determine active section: the one with highest visibility in the top half
        let bestId = '';
        let bestScore = -1;

        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (!id) continue;

          const rect = entry.boundingClientRect;
          const viewportCenter = window.innerHeight / 2;
          // Score: higher for sections closer to top of viewport and more visible
          const distFromCenter = Math.abs(rect.top + rect.height / 2 - viewportCenter);
          const score = entry.intersectionRatio * 1000 - distFromCenter;

          if (entry.isIntersecting && score > bestScore) {
            bestScore = score;
            bestId = id;
          }
        }

        if (bestId && bestId !== activeSectionId.value) {
          activeSectionId.value = bestId;
          activeSectionIndex.value = sectionIds.value.indexOf(bestId);
        }
      },
      {
        root: options.root?.value ?? null,
        rootMargin: options.rootMargin ?? '-10% 0px -40% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      },
    );

    // Observe all section elements
    for (const id of sectionIds.value) {
      const el = document.querySelector(`[data-section-id="${id}"]`);
      if (el) observer.observe(el);
    }
  }

  function cleanup(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
  }

  /** Smooth-scroll to a section by ID */
  function scrollToSection(sectionId: string): void {
    const el = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onMounted(() => {
    // SSR guard + defer setup to allow DOM to render
    if (typeof window === 'undefined') return;
    requestAnimationFrame(setup);
  });

  onUnmounted(cleanup);

  return {
    activeSectionId: computed(() => activeSectionId.value),
    activeSectionIndex: computed(() => activeSectionIndex.value),
    scrollProgress: computed(() => scrollProgress.value),
    sectionVisibility: computed(() => sectionVisibility.value),
    scrollToSection,
    /** Re-observe sections (call after dynamic section changes) */
    refresh: () => {
      cleanup();
      setup();
    },
  };
}
