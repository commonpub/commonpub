<script setup lang="ts">
// Auth layout — minimal centered layout for login/register
</script>

<template>
  <div class="auth-layout">
    <main class="auth-content">
      <NuxtLink to="/" class="auth-brand" aria-label="Return to homepage">
        CommonPub
      </NuxtLink>
      <slot />
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
  font-weight: var(--font-weight-bold);
  font-size: var(--text-2xl);
  color: var(--text);
  text-decoration: none;
}
</style>
