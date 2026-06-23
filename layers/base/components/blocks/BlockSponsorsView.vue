<script setup lang="ts">
/**
 * Read-side renderer for the `sponsors` block — a logo wall in a card with an
 * optional eyebrow heading. Logos that share a `tier` group together (tier labels
 * show only when at least one logo is tiered). Registered in BlockContentRenderer's
 * map. All colors via var(--*).
 */
import type { SponsorLogo } from '../../types/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();

const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading.trim() : ''));
const logos = computed<SponsorLogo[]>(() =>
  Array.isArray(props.content.logos) ? (props.content.logos as SponsorLogo[]).filter((l) => l && l.src) : [],
);
const safeLink = (url?: string): string | undefined => (url && /^https?:\/\//i.test(url) ? url : undefined);

// Group by tier, preserving first-seen order; untiered logos collect under ''.
const tiers = computed(() => {
  const order: string[] = [];
  const map = new Map<string, SponsorLogo[]>();
  for (const l of logos.value) {
    const key = (l.tier ?? '').trim();
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(l);
  }
  return order.map((label) => ({ label, logos: map.get(label)! }));
});
const hasTiers = computed(() => tiers.value.some((t) => t.label));
</script>

<template>
  <section v-if="logos.length" class="cpub-spon">
    <p v-if="heading" class="cpub-spon-eyebrow">{{ heading }}</p>
    <div class="cpub-spon-card">
      <div v-for="(t, ti) in tiers" :key="ti" class="cpub-spon-tier">
        <p v-if="hasTiers && t.label" class="cpub-spon-tier-label">{{ t.label }}</p>
        <ul class="cpub-spon-row">
          <li v-for="(l, i) in t.logos" :key="i" class="cpub-spon-item">
            <a
              v-if="safeLink(l.url)"
              :href="safeLink(l.url)"
              target="_blank"
              rel="noopener noreferrer"
              class="cpub-spon-link"
              :aria-label="l.alt || 'Sponsor'"
            >
              <img :src="l.src" :alt="l.alt || 'Sponsor'" class="cpub-spon-img" loading="lazy" />
            </a>
            <img v-else :src="l.src" :alt="l.alt || 'Sponsor'" class="cpub-spon-img" loading="lazy" />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cpub-spon { margin: var(--space-4) 0; }
.cpub-spon-eyebrow {
  text-align: center; font-family: var(--font-mono); font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-faint); margin: 0 0 12px;
}
.cpub-spon-card {
  background: var(--surface); border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow-md);
  padding: 24px 28px; display: flex; flex-direction: column; gap: 20px;
}
.cpub-spon-tier { display: flex; flex-direction: column; gap: 10px; }
.cpub-spon-tier-label {
  text-align: center; font-family: var(--font-mono); font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-dim); margin: 0;
}
.cpub-spon-row {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 24px 44px;
}
.cpub-spon-item { display: flex; align-items: center; }
/* Neutralize the .cpub-prose a/img leak (border-bottom underline, border box, shadow, margin). */
.cpub-spon-link { display: flex; align-items: center; transition: opacity 0.15s; border-bottom: 0; text-decoration: none; }
.cpub-spon-link:hover { opacity: 0.7; border-bottom: 0; }
.cpub-spon-img { max-height: 48px; max-width: 180px; width: auto; height: auto; object-fit: contain; display: block; border: 0; box-shadow: none; margin: 0; }

@media (max-width: 768px) {
  .cpub-spon-card { padding: 18px; }
  .cpub-spon-row { gap: 18px 28px; }
  .cpub-spon-img { max-height: 38px; max-width: 130px; }
}
</style>
