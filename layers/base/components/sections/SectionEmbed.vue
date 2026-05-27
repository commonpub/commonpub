<script setup lang="ts">
/**
 * Built-in section: embed — generic sandboxed iframe.
 *
 * Domain allowlist (hardcoded for v1; per-instance override via
 * `instance_settings.embedAllowlist` deferred to Phase 6b polish):
 * tweets (twitter/x), GitHub gists, CodePen, Loom, JSFiddle, Figma,
 * Glitch, Replit, plus the YouTube/Vimeo hosts (so this section can
 * substitute for `video` when an operator prefers explicit fixed-
 * height embedding).
 *
 * URLs from any other host render an "Embedding not allowed" message
 * (with the offending domain shown) so admins know to either reach
 * for a different section type or extend the allowlist.
 *
 * Sandbox: same restrictive policy as video — allow-scripts,
 * allow-same-origin, allow-presentation, allow-popups (for tweets
 * that open a profile in a new tab). NO allow-top-navigation.
 *
 * `var(--*)` only.
 */
import { computed } from 'vue';
import type { SectionRenderProps } from '@commonpub/ui';

interface EmbedConfig extends Record<string, unknown> {
  heading: string;
  src: string;
  title: string;
  height: number;
}

const props = defineProps<SectionRenderProps<EmbedConfig>>();

// Hardcoded allowlist for Phase 6b. Operator override via
// instance_settings.embedAllowlist coming next session.
const ALLOWED_HOSTS = new Set<string>([
  // Twitter / X
  'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
  'platform.twitter.com',
  // GitHub
  'gist.github.com', 'github.com',
  // CodePen
  'codepen.io',
  // Loom
  'loom.com', 'www.loom.com',
  // JSFiddle
  'jsfiddle.net',
  // Figma
  'figma.com', 'www.figma.com', 'embed.figma.com',
  // Glitch
  'glitch.com', 'glitch.me',
  // Replit
  'replit.com',
  // YouTube + Vimeo (overlap with video section by design)
  'youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
  'vimeo.com', 'player.vimeo.com',
]);

const parsed = computed(() => {
  if (!props.config.src) return null;
  try {
    return new URL(props.config.src);
  } catch {
    return null;
  }
});

const hostAllowed = computed(() => {
  if (!parsed.value) return false;
  return ALLOWED_HOSTS.has(parsed.value.host.toLowerCase());
});

const blockedHost = computed(() => parsed.value?.host ?? '');
</script>

<template>
  <section
    v-if="config.src"
    class="cpub-section-embed"
    :aria-labelledby="config.heading ? `section-embed-${meta.sectionId}` : undefined"
  >
    <h2
      v-if="config.heading"
      :id="`section-embed-${meta.sectionId}`"
      class="cpub-section-embed-heading"
    >
      {{ config.heading }}
    </h2>

    <div
      class="cpub-section-embed-frame"
      :style="{ height: hostAllowed ? `${config.height}px` : undefined }"
    >
      <iframe
        v-if="hostAllowed"
        :src="config.src"
        :title="config.title || 'Embedded content'"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow="encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen
        class="cpub-section-embed-media"
      />
      <div v-else class="cpub-section-embed-error">
        <i class="fa-solid fa-shield-halved" aria-hidden="true" />
        <div>
          <p class="cpub-section-embed-error-title">Embedding not allowed</p>
          <p v-if="blockedHost" class="cpub-section-embed-error-host">
            <code>{{ blockedHost }}</code> is not in the instance embed allowlist
          </p>
          <p v-else class="cpub-section-embed-error-host">
            URL could not be parsed
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-section-embed {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cpub-section-embed-heading {
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
.cpub-section-embed-frame {
  width: 100%;
  background: var(--surface-2);
  overflow: hidden;
  position: relative;
}
.cpub-section-embed-media {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.cpub-section-embed-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-5);
  color: var(--text-faint);
  font-size: var(--text-sm);
  background: var(--surface-2);
}
.cpub-section-embed-error i {
  font-size: var(--text-lg);
  color: var(--text-faint);
}
.cpub-section-embed-error-title {
  margin: 0 0 var(--space-1) 0;
  font-weight: 600;
  color: var(--text);
}
.cpub-section-embed-error-host {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
</style>
