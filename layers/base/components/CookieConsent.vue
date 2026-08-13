<script setup lang="ts">
const { hasConsented, hasNonEssentialCookies, acceptAll, acceptEssential, cookies } = useCookieConsent();

const visible = computed(() => !hasConsented.value && hasNonEssentialCookies.value);

// Name what is actually being asked about. The banner only appears because a
// non-essential cookie is declared, and on most instances that is analytics, so
// "essential functionality and to remember your preferences" described the one
// category the visitor is NOT being asked to consent to. Consent has to be
// specific to be informed.
const asksAboutAnalytics = computed(() =>
  cookies.value.some((c) => c.category === 'analytics'),
);

// A POINTER, not a fourth choice. Sharing what you tell us about yourself is a
// separate decision from cookies and lives on its own page; a visitor who
// declines analytics here would otherwise never learn it exists. Deliberately
// not a button and deliberately not folded into the consent level:
// `currentScope` digests cookies only, so a purpose reaching that digest would
// re-prompt every visitor on the instance.
const { dataSharingConsents } = useFeatures();

// Publish this bar's height so anything else docked to the bottom edge can
// clear it. The contest action bar is fixed to the same edge at a lower
// z-index, and this banner is shown to exactly the anonymous first-time visitor
// that bar exists for, so without this it would cover the bar completely.
const root = ref<HTMLElement | null>(null);
usePublishedHeight(root, '--cpub-consent-height');
</script>

<template>
  <Transition name="cpub-consent-slide">
    <div v-if="visible" ref="root" class="cpub-consent cpub-overlay-surface" role="dialog" aria-label="Cookie consent">
      <div class="cpub-consent-inner">
        <p class="cpub-consent-text">
          <template v-if="asksAboutAnalytics">
            Essential cookies keep this site working. Analytics cookies help us see which pages get used, and load only if you accept.
          </template>
          <template v-else>
            This site uses cookies for essential functionality and to remember your preferences.
          </template>
          <NuxtLink to="/cookies" class="cpub-consent-link">What we collect</NuxtLink>
          <NuxtLink v-if="dataSharingConsents" to="/settings/privacy" class="cpub-consent-link">Sharing choices</NuxtLink>
        </p>
        <!-- Both choices carry the SAME visual weight. Consent is only freely
             given if refusing is as easy as accepting, and a filled primary
             "Accept all" next to an outlined "Essential only" is the pattern
             regulators single out. Same size, same emphasis, one tap each. -->
        <div class="cpub-consent-actions">
          <button class="cpub-btn cpub-btn-sm cpub-consent-btn" @click="acceptEssential">
            Essential only
          </button>
          <button class="cpub-btn cpub-btn-sm cpub-consent-btn" @click="acceptAll">
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
  /* background comes from .cpub-overlay-surface (opaque compositing). */
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

/* Equal weight, so neither choice is the visually obvious one. */
.cpub-consent-btn { min-width: 8.5rem; justify-content: center; }

@media (max-width: 640px) {
  .cpub-consent-inner {
    flex-direction: column;
    align-items: stretch;
    /* Tighter than the desktop padding: this bar is fixed to the bottom of a
       small screen and every pixel it takes is content the visitor cannot see
       until they answer it. */
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
  }
  .cpub-consent-actions { justify-content: stretch; }
  .cpub-consent-actions .cpub-btn { flex: 1; min-width: 0; }
}
</style>
