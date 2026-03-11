<script lang="ts">
  import { enhance } from '$app/forms';

  let { slug }: { slug: string } = $props();
  let postType = $state('text');
  let pollOptions = $state(['', '']);
  let pollMultiSelect = $state(false);

  function addPollOption() {
    if (pollOptions.length < 10) {
      pollOptions = [...pollOptions, ''];
    }
  }

  function removePollOption(index: number) {
    if (pollOptions.length > 2) {
      pollOptions = pollOptions.filter((_, i) => i !== index);
    }
  }
</script>

<form method="POST" action="/communities/{slug}?/createPost" use:enhance class="post-composer">
  <div class="composer-type">
    <label>
      <input type="radio" name="type" value="text" bind:group={postType} />
      Text
    </label>
    <label>
      <input type="radio" name="type" value="link" bind:group={postType} />
      Link
    </label>
    <label>
      <input type="radio" name="type" value="share" bind:group={postType} />
      Share
    </label>
    <label>
      <input type="radio" name="type" value="poll" bind:group={postType} />
      Poll
    </label>
  </div>

  {#if postType === 'share'}
    <input
      type="text"
      name="sharedContentId"
      class="composer-input"
      placeholder="Content ID to share..."
      required
      aria-label="Content ID to share"
    />
    <textarea
      name="content"
      class="composer-content"
      rows="2"
      placeholder="Add a comment (optional)..."
      maxlength="10000"
      aria-label="Share comment"
    ></textarea>
  {:else if postType === 'poll'}
    <textarea
      name="content"
      class="composer-content"
      rows="2"
      placeholder="Ask a question..."
      required
      maxlength="10000"
      aria-label="Poll question"
    ></textarea>
    <div class="poll-options">
      {#each pollOptions as option, i}
        <div class="poll-option-row">
          <input
            type="text"
            name="pollOptions"
            class="composer-input"
            placeholder="Option {i + 1}"
            required
            maxlength="200"
            bind:value={pollOptions[i]}
            aria-label="Poll option {i + 1}"
          />
          {#if pollOptions.length > 2}
            <button type="button" class="poll-remove-btn" onclick={() => removePollOption(i)} aria-label="Remove option {i + 1}">&times;</button>
          {/if}
        </div>
      {/each}
      {#if pollOptions.length < 10}
        <button type="button" class="poll-add-btn" onclick={addPollOption}>+ Add option</button>
      {/if}
    </div>
    <label class="poll-multi-label">
      <input type="checkbox" name="pollMultiSelect" bind:checked={pollMultiSelect} />
      Allow multiple selections
    </label>
  {:else}
    <textarea
      name="content"
      class="composer-content"
      rows="3"
      placeholder={postType === 'link' ? 'Paste a URL...' : "What's on your mind?"}
      required
      maxlength="10000"
      aria-label={postType === 'link' ? 'Link URL' : 'Post content'}
    ></textarea>
  {/if}

  <button type="submit" class="btn btn-primary">Post</button>
</form>

<style>
  .post-composer {
    padding: var(--space-4, 1rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    background: var(--color-surface, #0c0c0b);
    margin-bottom: var(--space-4, 1rem);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .composer-type {
    display: flex;
    gap: var(--space-4, 1rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
  }

  .composer-type label {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    cursor: pointer;
  }

  .composer-content {
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    resize: vertical;
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
  }

  .composer-input {
    padding: var(--space-2, 0.5rem);
    border: 1px solid var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-sm, 0.875rem);
    background: var(--color-surface, #0c0c0b);
    color: var(--color-text, #d8d5cf);
    width: 100%;
  }

  .poll-options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .poll-option-row {
    display: flex;
    gap: var(--space-1, 0.25rem);
    align-items: center;
  }

  .poll-remove-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-lg, 1.125rem);
    cursor: pointer;
    padding: 0 var(--space-1, 0.25rem);
  }

  .poll-add-btn {
    background: none;
    border: 1px dashed var(--color-border, #272725);
    border-radius: var(--radius-md, 6px);
    color: var(--color-text-secondary, #888884);
    font-size: var(--text-sm, 0.875rem);
    padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
    cursor: pointer;
    align-self: flex-start;
  }

  .poll-multi-label {
    display: flex;
    align-items: center;
    gap: var(--space-1, 0.25rem);
    font-size: var(--text-sm, 0.875rem);
    color: var(--color-text, #d8d5cf);
    cursor: pointer;
  }

  .btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    border: none;
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-md, 1rem);
    cursor: pointer;
    align-self: flex-end;
  }

  .btn-primary {
    background: var(--color-primary, #2563eb);
    color: var(--color-on-primary, #ffffff);
  }
</style>
