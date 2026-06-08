<template>
  <a href="#main-content" class="cpub-skip-link">Skip to main content</a>
  <NuxtLoadingIndicator color="var(--accent)" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <!-- Film-grain overlay. Invisible unless the active theme sets --grain > 0 (default 0). -->
  <div class="cpub-grain" aria-hidden="true" />
</template>

<style>
.cpub-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: var(--grain, 0);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
@media print { .cpub-grain { display: none; } }
</style>
