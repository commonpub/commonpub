<script lang="ts">
  interface Props {
    text: string;
    class?: string;
  }

  let { text, class: className = '' }: Props = $props();
</script>

<span
  class={['snaplify-sr-only', className].filter(Boolean).join(' ')}
  style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;"
>
  {text}
</span>
