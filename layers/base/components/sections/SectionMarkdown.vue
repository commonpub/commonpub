<script setup lang="ts">
/**
 * Built-in section: markdown — sanitised markdown body.
 *
 * Pipes `config.body` (markdown source) through `@commonpub/docs`'s
 * `renderMarkdown` which runs remark-parse + remark-gfm +
 * rehype-sanitize (with the same allowlist schema docs pages use).
 *
 * useAsyncData wraps the call so SSR renders the HTML, the result is
 * serialised into the hydration payload, and the client doesn't re-
 * parse on mount. The key includes the body length + meta.sectionId
 * so two identical bodies on the same page share a single render,
 * while different bodies don't collide.
 *
 * On parse error (malformed markdown is rare but possible): logs +
 * renders the raw source as a code block. Better than blank.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import { renderMarkdown } from '@commonpub/docs';
import type { SectionRenderProps } from '@commonpub/ui';

interface MarkdownConfig extends Record<string, unknown> {
  heading: string;
  body: string;
}

const props = defineProps<SectionRenderProps<MarkdownConfig>>();

// Stable key per (body, sectionId) so concurrent identical sections dedupe
const cacheKey = computed(
  () => `section-markdown:${props.meta.sectionId}:${props.config.body.length}:${
    // First 16 chars of a hash-ish surrogate (cheap, doesn't need to be cryptographic)
    props.config.body.slice(0, 16)
  }`,
);

// NO top-level await — matches the session-158 pitfall fix in
// SectionContentFeed. useAsyncData populates the data ref at SSR time
// without requiring a parent Suspense boundary. Initial render before
// the data is ready falls into the v-if guard below; populated content
// pops in once the async render completes (Vue reactivity).
const { data: rendered } = useAsyncData(
  cacheKey.value,
  async () => {
    if (!props.config.body) return { html: '' };
    try {
      const result = await renderMarkdown(props.config.body);
      return { html: result.html };
    } catch (err) {
      console.error('[section:markdown] renderMarkdown failed:', err);
      // Fail-soft: render as escaped pre block
      const escaped = props.config.body
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return { html: `<pre><code>${escaped}</code></pre>` };
    }
  },
);
</script>

<template>
  <section
    v-if="config.body"
    class="cpub-section-markdown"
    :aria-labelledby="config.heading ? `section-md-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-md-${meta.sectionId}`"
      class="cpub-section-markdown-heading"
    >
      {{ config.heading }}
    </h2>
    <!--
      v-html here is safe because the HTML went through rehype-sanitize
      with @commonpub/docs's allowlist schema. The schema rejects <script>,
      event handlers (onclick=…), javascript: URLs, etc. See
      packages/docs/src/render/pipeline.ts for the schema.
    -->
    <div class="cpub-section-markdown-body cpub-prose" v-html="rendered?.html ?? ''" />
  </section>
</template>

<style scoped>
.cpub-section-markdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-markdown-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: var(--border-width-default) solid var(--border);
}
.cpub-section-markdown-body {
  font-size: var(--text-base);
  line-height: 1.7;
  color: var(--text);
}
</style>
