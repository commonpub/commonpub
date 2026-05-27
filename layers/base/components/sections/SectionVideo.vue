<script setup lang="ts">
/**
 * Built-in section: video — YouTube/Vimeo embed OR local file.
 *
 * Dispatches between `<video>` (local file) and `<iframe sandbox>`
 * (provider embed). Detection: anything that toEmbedUrl rewrites is
 * an embed; everything else is treated as a direct media URL.
 *
 * Iframe sandbox: allow-scripts + allow-same-origin + allow-presentation
 * (player needs scripts for controls; same-origin lets the player set
 * cookies for resume; presentation lets fullscreen work). NO
 * allow-top-navigation — embeds can't navigate the parent page.
 *
 * Local `<video>`: preload="metadata" only (don't pull MBs of bytes
 * before the user clicks play). controls always shown — autoplay flag
 * adds `autoplay muted` (browsers require muted for autoplay).
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import { toEmbedUrl } from '../../utils/embedUrl';
import type { SectionRenderProps } from '@commonpub/ui';

interface VideoConfig extends Record<string, unknown> {
  heading: string;
  src: string;
  title: string;
  aspectRatio: '16/9' | '4/3' | '1/1' | '9/16';
  autoplay: boolean;
}

const props = defineProps<SectionRenderProps<VideoConfig>>();

// File extensions that map to native <video> rendering. Anything else
// gets the embed path (toEmbedUrl turns YouTube watch URLs into the
// nocookie iframe form, etc).
const LOCAL_VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i;

const isLocalFile = computed(() => {
  const s = props.config.src;
  if (!s) return false;
  // Relative path (starts with /) OR has a known local extension → render <video>
  return s.startsWith('/') || LOCAL_VIDEO_EXT.test(s);
});

const embedSrc = computed(() => {
  if (isLocalFile.value) return '';
  return toEmbedUrl(props.config.src);
});
</script>

<template>
  <section
    v-if="config.src"
    class="cpub-section-video"
    :aria-labelledby="config.heading ? `section-video-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-video-${meta.sectionId}`"
      class="cpub-section-video-heading"
    >
      {{ config.heading }}
    </h2>

    <div class="cpub-section-video-frame" :data-aspect="config.aspectRatio">
      <video
        v-if="isLocalFile"
        :src="config.src"
        controls
        preload="metadata"
        :autoplay="config.autoplay || undefined"
        :muted="config.autoplay || undefined"
        playsinline
        class="cpub-section-video-media"
      />
      <iframe
        v-else-if="embedSrc"
        :src="embedSrc"
        :title="config.title || 'Embedded video'"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen
        class="cpub-section-video-media"
      />
      <div v-else class="cpub-section-video-error">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>Video source could not be embedded.</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-section-video {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-video-heading {
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
.cpub-section-video-frame {
  position: relative;
  width: 100%;
  background: var(--surface-2);
  overflow: hidden;
}
.cpub-section-video-frame[data-aspect='16/9'] { aspect-ratio: 16 / 9; }
.cpub-section-video-frame[data-aspect='4/3']  { aspect-ratio: 4 / 3; }
.cpub-section-video-frame[data-aspect='1/1']  { aspect-ratio: 1 / 1; }
.cpub-section-video-frame[data-aspect='9/16'] { aspect-ratio: 9 / 16; max-width: 480px; }

.cpub-section-video-media {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  position: absolute;
  inset: 0;
}

.cpub-section-video-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-faint);
  font-size: var(--text-sm);
  position: absolute;
  inset: 0;
}
</style>
