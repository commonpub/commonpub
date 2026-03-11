<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { applyThemeToElement, validateTokenOverrides } from '@snaplify/ui';
  import '@snaplify/ui/theme/base.css';
  import '@snaplify/ui/theme/generics.css';
  import '@snaplify/ui/theme/deepwood.css';
  import '@snaplify/ui/theme/hackbuild.css';
  import '@snaplify/ui/theme/deveco.css';
  import '$lib/styles/primitives.css';
  import type { LayoutData } from './$types';

  let { data, children } = $props<{ data: LayoutData; children: import('svelte').Snippet }>();

  $effect(() => {
    const html = document.documentElement;
    const theme = data.theme ?? 'generics';
    applyThemeToElement(html, theme);

    if (data.customTokens) {
      const { valid } = validateTokenOverrides(data.customTokens);
      for (const [key, value] of Object.entries(valid)) {
        html.style.setProperty(`--${key}`, value);
      }
    }
  });
</script>

<div class="app">
  <Nav user={data.user} />
  <main class="main">
    {@render children()}
  </main>
  <Footer />
</div>

<style>
  :global(html) {
    font-family: var(--font-body, system-ui, -apple-system, sans-serif);
    color: var(--color-text, #d8d5cf);
    background: var(--color-surface, #0c0c0b);
    font-size: var(--text-base, 0.875rem);
    line-height: var(--leading-normal, 1.6);
  }

  :global(body) {
    margin: 0;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(a) {
    color: var(--color-link, var(--color-primary, #5b9cf6));
  }

  :global(a:hover) {
    color: var(--color-link-hover, var(--color-primary-hover, #4a8be5));
  }

  :global(::selection) {
    background: var(--color-primary, #5b9cf6);
    color: var(--color-primary-text, #0c0c0b);
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .main {
    flex: 1;
    width: 100%;
  }
</style>
