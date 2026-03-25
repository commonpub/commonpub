<script setup lang="ts">
// Auth layout — minimal centered layout for login/register
</script>

<template>
  <div class="auth-layout">
    <main class="auth-content">
      <NuxtLink to="/" class="auth-brand" aria-label="Return to homepage">
        <span class="auth-bracket">[</span>C<span class="auth-bracket">]</span> CommonPub
      </NuxtLink>
      <div class="auth-card">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  padding: var(--space-4);
}

.auth-content {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.auth-brand {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 18px;
  color: var(--text);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 2px;
}

.auth-bracket {
  color: var(--accent);
  font-size: 20px;
}

.auth-card {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
}
</style>
