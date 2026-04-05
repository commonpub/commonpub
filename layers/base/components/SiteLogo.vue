<template>
  <span class="cpub-site-logo">
    <!-- Classic logo: shown by default, hidden when Agora active -->
    <span class="cpub-logo-classic">
      <span class="cpub-logo-bracket">[</span>C<span class="cpub-logo-bracket">]</span>
      <span class="cpub-logo-name">CommonPub</span>
    </span>

    <!-- Agora logo: hidden by default, shown when Agora active via CSS -->
    <span class="cpub-logo-agora">
      <!-- Town Square mark: 4 blocks with content lines + green center -->
      <svg class="cpub-logo-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="22" height="22" aria-hidden="true">
        <rect x="18" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="110" y="18" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="18" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="110" y="110" width="72" height="72" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <rect x="88" y="88" width="24" height="24" fill="var(--accent, #3d8b5e)"/>
        <line x1="34" y1="54" x2="72" y2="54" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="128" y1="46" x2="166" y2="46" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="34" y1="148" x2="68" y2="148" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="128" y1="142" x2="162" y2="142" stroke="var(--accent, #3d8b5e)" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
      </svg>
      <span class="cpub-logo-wordmark">Common<span class="cpub-logo-pub">Pub</span></span>
    </span>
  </span>
</template>

<style scoped>
.cpub-site-logo {
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

/* Classic logo */
.cpub-logo-classic {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-family: var(--font-mono);
}
.cpub-logo-bracket { color: var(--accent); font-size: 15px; }
.cpub-logo-name { margin-left: 2px; }

/* Agora logo — hidden by default */
.cpub-logo-agora {
  display: none;
  align-items: center;
  gap: 6px;
}
.cpub-logo-mark { flex-shrink: 0; }
.cpub-logo-wordmark {
  font-family: var(--font-display, var(--font-heading));
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.02em;
}
.cpub-logo-pub { color: var(--accent); }
</style>

<style>
/* Switch logos based on data-theme — pure CSS, no JS hydration needed */
[data-theme="agora"] .cpub-logo-classic,
[data-theme="agora-dark"] .cpub-logo-classic {
  display: none !important;
}
[data-theme="agora"] .cpub-logo-agora,
[data-theme="agora-dark"] .cpub-logo-agora {
  display: flex !important;
}
</style>
