<script setup lang="ts">
/**
 * Headless author avatar shared by the content views (ProjectView, ArticleView).
 *
 * Renders an <img class="cpub-av"> when `src` is present, else an initials
 * <div class="cpub-av"> (first two letters of `name`, uppercased, falling back
 * to 'CP'). The .cpub-av CSS lives HERE — Vue scoped styles are hashed per
 * component instance, so the avatar rules cannot be left behind in the views;
 * they must travel with the markup. The .cpub-av block (square-lock, border,
 * object-fit, div-only flex centering) is copied verbatim from the pre-dedup
 * ProjectView/ArticleView so behaviour is identical.
 *
 * Size is per-call: ProjectView's byline was 36px, ArticleView's byline 44px,
 * ArticleView's author card 64px — so callers pass `size`/`fontSize` (the only
 * value that ever diverged between the two views).
 */
const props = withDefaults(
  defineProps<{
    src?: string | null;
    name: string;
    /** Avatar diameter in px. */
    size?: number;
    /** Initials font-size in px. */
    fontSize?: number;
  }>(),
  { src: null, size: 28, fontSize: 10 },
);

const initials = computed(() => props.name?.slice(0, 2).toUpperCase() || 'CP');
const cssVars = computed(() => ({
  '--cpub-av-size': `${props.size}px`,
  '--cpub-av-font': `${props.fontSize}px`,
}));
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="name"
    class="cpub-av"
    :style="cssVars"
  />
  <div v-else class="cpub-av" :style="cssVars">{{ initials }}</div>
</template>

<style scoped>
/* ── AVATARS ──
 * Two render modes share the .cpub-av class:
 *   <img class="cpub-av" ...>          ← avatar photo
 *   <div class="cpub-av">JD</div>      ← initials fallback when no avatar
 *
 * Sizing + border-radius is shared. But `display: flex` MUST NOT apply to
 * the <img> — when a replaced element gets `display: flex` set, browsers
 * (notably Chromium) treat the img content render-box inconsistently and
 * the inline `object-fit: cover` is silently dropped, producing a squished
 * (stretched-to-box) image instead of a center-cropped one. Visible on
 * deveco.io blog pages where author avatars are vertical photos (e.g.
 * 816×1456) rendered into a 44×44 square.
 *
 * Fix: scope display:flex centering to the div variant only.
 */
.cpub-av {
  --cpub-av-size: 28px;
  --cpub-av-font: 10px;
  width: var(--cpub-av-size);
  height: var(--cpub-av-size);
  /* Hard-lock to a square. Without min/max clamps, a global img reset or a
     dropped dimension lets the <img> fall back to its intrinsic aspect ratio,
     so a portrait photo renders as a tall oval (the deveco blog-avatar bug -
     visible even on wide viewports, so it's not flex compression). min/max on
     BOTH axes clamp the used size regardless of what sets width/height. */
  min-width: var(--cpub-av-size);
  max-width: var(--cpub-av-size);
  min-height: var(--cpub-av-size);
  max-height: var(--cpub-av-size);
  border-radius: 50%;
  background: var(--surface3);
  border: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

div.cpub-av {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--cpub-av-font);
  font-weight: 700;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

/* Defensive: even when consumers forget the inline `object-fit:cover`,
   img.cpub-av crops instead of stretching. */
img.cpub-av {
  object-fit: cover;
}
</style>
