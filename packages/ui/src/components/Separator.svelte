<script lang="ts">
  interface Props {
    orientation?: 'horizontal' | 'vertical';
    class?: string;
  }

  let {
    orientation = 'horizontal',
    class: className = '',
  }: Props = $props();
</script>

<div
  class={['snaplify-separator', `snaplify-separator--${orientation}`, className]
    .filter(Boolean)
    .join(' ')}
  role="separator"
  aria-orientation={orientation}
></div>

<style>
  .snaplify-separator {
    flex-shrink: 0;
    background: var(--color-border, #e2e8f0);
  }

  .snaplify-separator--horizontal {
    height: 1px;
    width: 100%;
  }

  .snaplify-separator--vertical {
    width: 1px;
    height: 100%;
    align-self: stretch;
  }
</style>
