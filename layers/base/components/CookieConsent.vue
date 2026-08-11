<script setup lang="ts">
const { hasConsented, hasNonEssentialCookies, acceptAll, acceptEssential } = useCookieConsent();

const visible = computed(() => !hasConsented.value && hasNonEssentialCookies.value);

// Publish this bar's height so anything else docked to the bottom edge can clear
// it. The contest action bar is fixed to the same edge at a lower z-index, and
// this banner is shown to exactly the anonymous first-time visitor that bar
// exists for — so without this it covers the bar completely. Measured, because
// the height depends on the copy wrapping and on the <=640px stacked layout.
const root = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;

function publish(px: number): void {
  document.documentElement.style.setProperty('--cpub-consent-height', `${Math.ceil(px)}px`);
}
function clear(): void {
  document.documentElement.style.removeProperty('--cpub-consent-height');
}

watch(root, (el) => {
  ro?.disconnect();
  ro = null;
  if (!el || typeof ResizeObserver === 'undefined') { clear(); return; }
  ro = new ResizeObserver(([entry]) => {
    const h = entry.target.getBoundingClientRect().height;
    if (h > 0) publish(h); else clear();
  });
  ro.observe(el);
});

onUnmounted(() => { ro?.disconnect(); clear(); });
</script>

<template>
  <Transition name="cpub-consent-slide">
    <div v-if="visible" ref="root" class="cpub-consent" role="dialog" aria-label="Cookie consent">
      <div class="cpub-consent-inner">
        <p class="cpub-consent-text">
          This site uses cookies for essential functionality and to remember your preferences.
          <NuxtLink to="/cookies" class="cpub-consent-link">Learn more</NuxtLink>
        </p>
        <div class="cpub-consent-actions">
          <button class="cpub-btn cpub-btn-sm" @click="acceptEssential">
            Essential only
          </button>
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="acceptAll">
            Accept all
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cpub-consent {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-toast);
  background: var(--surface);
  border-top: var(--border-width-default) solid var(--border);
  box-shadow: 0 -2px 0 var(--border);
}

.cpub-consent-inner {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.cpub-consent-text {
  font-size: var(--text-sm);
  color: var(--text-dim);
  line-height: var(--leading-snug);
  flex: 1;
  min-width: 0;
}

.cpub-consent-link {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cpub-consent-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* Slide-up transition */
.cpub-consent-slide-enter-active,
.cpub-consent-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.cpub-consent-slide-enter-from,
.cpub-consent-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 640px) {
  .cpub-consent-inner {
    flex-direction: column;
    align-items: stretch;
    padding: var(--space-4);
  }
  .cpub-consent-actions { justify-content: stretch; }
  .cpub-consent-actions .cpub-btn { flex: 1; }
}
</style>
