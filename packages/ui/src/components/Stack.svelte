<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    direction?: 'horizontal' | 'vertical';
    gap?: string;
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    wrap?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    direction = 'vertical',
    gap = 'var(--space-4, 1rem)',
    align = 'stretch',
    justify = 'start',
    wrap = false,
    class: className = '',
    children,
  }: Props = $props();

  const justifyMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  };

  const alignMap: Record<string, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  };
</script>

<div
  class={['snaplify-stack', className].filter(Boolean).join(' ')}
  style="flex-direction: {direction === 'horizontal' ? 'row' : 'column'}; gap: {gap}; align-items: {alignMap[align]}; justify-content: {justifyMap[justify]}; flex-wrap: {wrap ? 'wrap' : 'nowrap'};"
>
  {@render children()}
</div>

<style>
  .snaplify-stack {
    display: flex;
  }
</style>
