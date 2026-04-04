<script setup lang="ts">
const { themeId } = useTheme();
const isAgora = computed(() => themeId.value === 'agora' || themeId.value === 'agora-dark');
</script>

<template>
  <span class="cpub-site-logo">
    <template v-if="isAgora">
      <!-- Town Square mark: 4 blocks + green center -->
      <svg class="cpub-logo-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="22" height="22" aria-hidden="true">
        <rect x="18" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="110" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="18" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="110" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="88" y="88" width="24" height="24" fill="var(--accent, #3d8b5e)"/>
        <!-- Content lines: 1 green accent per block -->
        <line x1="34" y1="54" x2="72" y2="54" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="128" y1="46" x2="166" y2="46" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="34" y1="148" x2="68" y2="148" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="128" y1="142" x2="162" y2="142" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
      </svg>
      <span class="cpub-logo-name cpub-logo-name--agora">Common<span class="cpub-logo-pub">Pub</span></span>
    </template>
    <template v-else>
      <span class="cpub-logo-bracket">[</span>C<span class="cpub-logo-bracket">]</span>
      <span class="cpub-logo-name">CommonPub</span>
    </template>
  </span>
</template>

<style scoped>
.cpub-site-logo {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
  white-space: nowrap;
}
.cpub-logo-bracket { color: var(--accent); font-size: 15px; }
.cpub-logo-name { margin-left: 2px; }

/* Agora wordmark */
.cpub-logo-mark {
  margin-right: 6px;
  flex-shrink: 0;
}
.cpub-logo-name--agora {
  font-family: var(--font-display, var(--font-heading));
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.02em;
  margin-left: 0;
}
.cpub-logo-pub {
  color: var(--accent);
}
</style>
