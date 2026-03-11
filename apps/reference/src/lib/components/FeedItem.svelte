<script lang="ts">
  let {
    avatar = '',
    user = '',
    action = '',
    timestamp = '',
    refTitle = '',
    refType = '',
    refHref = '#',
  }: {
    avatar: string;
    user: string;
    action: string;
    timestamp: string;
    refTitle?: string;
    refType?: string;
    refHref?: string;
  } = $props();
</script>

<div class="feed-item">
  <div class="av">{avatar}</div>
  <div class="feed-body">
    <div class="feed-action">
      <strong>{user}</strong>&nbsp;{action}
      <span class="ts">{timestamp}</span>
    </div>
    {#if refTitle}
      <a href={refHref} class="feed-ref">
        <div class="feed-thumb"></div>
        <div>
          {#if refType}
            <div class="ref-type">{refType}</div>
          {/if}
          <div class="ref-title">{refTitle}</div>
        </div>
      </a>
    {/if}
  </div>
</div>

<style>
  a.feed-ref {
    text-decoration: none;
    color: inherit;
  }

  a.feed-ref:hover {
    border-color: var(--color-border-strong, #333330);
  }
</style>
