<script setup lang="ts">
/**
 * Preview scene: "Spec sheet" — the GAUGE design-system bench, ported to
 * CommonPub's `--*` token namespace. Where the Gallery scene shows real
 * components in context, this scene visualizes the raw tokens: named color
 * swatches with live hex + WCAG readout, a type ladder, spacing bars,
 * radius + shadow tiles, and the four font roles.
 *
 * It reads RESOLVED values via getComputedStyle on its root, so the hex +
 * contrast labels are correct whether a token was set explicitly or is
 * inherited from the parent theme. Re-reads whenever `tokens` or the
 * preview mode changes.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { contrast, wcag } from '@commonpub/theme-studio';

const props = defineProps<{
  /** The in-progress token override map (used as a change trigger). */
  tokens: Record<string, string>;
  /** Preview mode key — changes when the Light/Dark toggle flips. */
  modeKey: string;
}>();

const root = ref<HTMLElement | null>(null);
/** Resolved token values, keyed by token name (no `--`). */
const resolved = ref<Record<string, string>>({});

const SWATCH_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Surfaces',
    items: [
      ['bg', 'page background'],
      ['surface', 'card / panel'],
      ['surface2', 'input / hover fill'],
      ['surface3', 'deeper fill'],
    ],
  },
  {
    title: 'Text',
    items: [
      ['text', 'primary text'],
      ['text-dim', 'secondary'],
      ['text-faint', 'muted / labels'],
    ],
  },
  {
    title: 'Accent + borders',
    items: [
      ['accent', 'primary accent'],
      ['color-primary-hover', 'accent hover'],
      ['border', 'strong border'],
      ['border2', 'soft border'],
    ],
  },
  {
    title: 'Semantic',
    items: [
      ['green', 'success'],
      ['yellow', 'warning'],
      ['red', 'error'],
    ],
  },
];

const ALL_KEYS = [
  ...SWATCH_GROUPS.flatMap((g) => g.items.map(([k]) => k)),
  'font-display',
  'font-body',
  'font-mono',
];

const TYPE_STEPS = ['5xl', '4xl', '3xl', '2xl', 'xl', 'lg', 'md', 'base', 'sm', 'xs'] as const;
const SPACE_STEPS = ['1', '2', '3', '4', '6', '8', '12', '16'] as const;
const RADIUS_STEPS = ['sm', 'md', 'lg', 'xl'] as const;
const SHADOW_STEPS = ['sm', 'md', 'lg', 'xl'] as const;

function readResolved(): void {
  const el = root.value;
  if (!el || typeof window === 'undefined') return;
  const cs = getComputedStyle(el);
  const next: Record<string, string> = {};
  for (const key of ALL_KEYS) {
    next[key] = cs.getPropertyValue(`--${key}`).trim();
  }
  resolved.value = next;
}

function refresh(): void {
  void nextTick(() => readResolved());
}

onMounted(refresh);
watch(() => [props.tokens, props.modeKey], refresh, { deep: true });

/** Normalize a resolved color to a comparable hex (best-effort). */
function asHex(v: string): string {
  return v.startsWith('#') ? v.toUpperCase() : v;
}

const contrastReadout = computed<{ ratio: string; band: string; ok: boolean } | null>(() => {
  const text = resolved.value['text'];
  const bg = resolved.value['bg'];
  if (!text || !bg || !text.startsWith('#') || !bg.startsWith('#')) return null;
  const r = contrast(text, bg);
  const band = wcag(r);
  return { ratio: r.toFixed(2), band, ok: band !== 'FAIL' };
});
</script>

<template>
  <div ref="root" class="cpub-sheet">
    <header class="cpub-sheet-head">
      <h2 class="cpub-sheet-title">Design tokens</h2>
      <p class="cpub-sheet-sub">Live values for the theme in progress. Built, not generated.</p>
    </header>

    <!-- Color -->
    <section class="cpub-sheet-sec">
      <div class="cpub-sheet-sec-h"><span class="cpub-sheet-num">01</span><h3>Color</h3></div>
      <div class="cpub-sheet-cgrid">
        <div v-for="grp in SWATCH_GROUPS" :key="grp.title" class="cpub-sheet-cgroup">
          <div class="cpub-sheet-cgroup-t">{{ grp.title }}</div>
          <div class="cpub-sheet-sw-grid">
            <div v-for="[key, role] in grp.items" :key="key" class="cpub-sheet-sw">
              <span class="cpub-sheet-chip" :style="{ background: `var(--${key})` }" />
              <span class="cpub-sheet-sw-meta">
                <span class="cpub-sheet-sw-name">--{{ key }}</span>
                <span class="cpub-sheet-sw-hex">{{ asHex(resolved[key] || '') }}</span>
                <span class="cpub-sheet-sw-role">{{ role }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="contrastReadout" class="cpub-sheet-contrast">
        <span class="cpub-sheet-contrast-tag">contrast · text on bg</span>
        <span class="cpub-sheet-contrast-val">{{ contrastReadout.ratio }}:1</span>
        <span class="cpub-sheet-badge" :class="contrastReadout.ok ? 'ok' : 'err'">{{ contrastReadout.band }}</span>
      </div>
    </section>

    <!-- Type -->
    <section class="cpub-sheet-sec">
      <div class="cpub-sheet-sec-h"><span class="cpub-sheet-num">02</span><h3>Typography</h3></div>
      <div class="cpub-sheet-roles">
        <div class="cpub-sheet-role" style="font-family: var(--font-display)">
          <span class="cpub-sheet-role-tag">Display</span>
          <span class="cpub-sheet-role-sample" style="font-size: var(--text-3xl)">Forge the type</span>
        </div>
        <div class="cpub-sheet-role" style="font-family: var(--font-body)">
          <span class="cpub-sheet-role-tag">Body</span>
          <span class="cpub-sheet-role-sample" style="font-size: var(--text-md)">Pack my box with five dozen liquor jugs.</span>
        </div>
        <div class="cpub-sheet-role" style="font-family: var(--font-mono)">
          <span class="cpub-sheet-role-tag">Mono</span>
          <span class="cpub-sheet-role-sample" style="font-size: var(--text-sm)">const tokens = build(recipe);</span>
        </div>
      </div>
      <div class="cpub-sheet-ladder">
        <div v-for="step in TYPE_STEPS" :key="step" class="cpub-sheet-ladder-row">
          <span class="cpub-sheet-ladder-tag">text-{{ step }}</span>
          <span class="cpub-sheet-ladder-sample" :style="{ fontSize: `var(--text-${step})` }">Forge the type</span>
        </div>
      </div>
    </section>

    <!-- Spacing / radius / shadow -->
    <section class="cpub-sheet-sec">
      <div class="cpub-sheet-sec-h"><span class="cpub-sheet-num">03</span><h3>Spacing · radius · elevation</h3></div>
      <div class="cpub-sheet-sublabel">Spacing</div>
      <div class="cpub-sheet-space">
        <div v-for="step in SPACE_STEPS" :key="step" class="cpub-sheet-space-row">
          <span class="cpub-sheet-space-tag">space-{{ step }}</span>
          <span class="cpub-sheet-space-bar" :style="{ width: `var(--space-${step})` }" />
        </div>
      </div>
      <div class="cpub-sheet-sublabel">Radius</div>
      <div class="cpub-sheet-tiles">
        <div v-for="step in RADIUS_STEPS" :key="step" class="cpub-sheet-tile" :style="{ borderRadius: `var(--radius-${step})` }">{{ step }}</div>
      </div>
      <div class="cpub-sheet-sublabel">Elevation</div>
      <div class="cpub-sheet-tiles">
        <div v-for="step in SHADOW_STEPS" :key="step" class="cpub-sheet-tile" :style="{ boxShadow: `var(--shadow-${step})` }">{{ step }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cpub-sheet {
  font-family: var(--font-body);
  color: var(--text);
  max-width: 880px;
  margin: 0 auto;
}
.cpub-sheet-head { margin-bottom: var(--space-6); }
.cpub-sheet-title { font-family: var(--font-display); font-size: var(--text-3xl); font-weight: var(--font-weight-bold); margin: 0; }
.cpub-sheet-sub { color: var(--text-dim); font-size: var(--text-sm); margin: var(--space-2) 0 0; }

.cpub-sheet-sec { padding: var(--space-6) 0; border-top: var(--border-width-thin) solid var(--border2); }
.cpub-sheet-sec-h { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-5); }
.cpub-sheet-num { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--accent); font-weight: var(--font-weight-bold); }
.cpub-sheet-sec-h h3 { font-family: var(--font-display); font-size: var(--text-xl); margin: 0; font-weight: var(--font-weight-bold); }

.cpub-sheet-cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
.cpub-sheet-cgroup-t { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); margin-bottom: var(--space-3); }
.cpub-sheet-sw-grid { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-sheet-sw { display: flex; align-items: center; gap: var(--space-3); }
.cpub-sheet-chip { width: 40px; height: 40px; border: var(--border-width-thin) solid var(--border); border-radius: var(--radius-md); flex-shrink: 0; }
.cpub-sheet-sw-meta { display: flex; flex-direction: column; min-width: 0; }
.cpub-sheet-sw-name { font-family: var(--font-mono); font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
.cpub-sheet-sw-hex { font-family: var(--font-mono); font-size: var(--text-label); color: var(--text-dim); }
.cpub-sheet-sw-role { font-family: var(--font-mono); font-size: var(--text-label); color: var(--text-faint); }

.cpub-sheet-contrast { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); padding-top: var(--space-4); border-top: var(--border-width-thin) solid var(--border2); }
.cpub-sheet-contrast-tag { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); }
.cpub-sheet-contrast-val { font-family: var(--font-mono); font-size: var(--text-base); font-weight: var(--font-weight-bold); }
.cpub-sheet-badge { font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-bold); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-thin) solid; }
.cpub-sheet-badge.ok { color: var(--green-text); border-color: var(--green); }
.cpub-sheet-badge.err { color: var(--red-text); border-color: var(--red); }

.cpub-sheet-roles { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-5); }
.cpub-sheet-role { border: var(--border-width-thin) solid var(--border2); border-left: var(--border-width-thick) solid var(--accent); padding: var(--space-4); background: var(--surface); }
.cpub-sheet-role-tag { display: block; font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); margin-bottom: var(--space-3); }
.cpub-sheet-role-sample { color: var(--text); line-height: var(--leading-tight); word-break: break-word; }

.cpub-sheet-ladder { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-sheet-ladder-row { display: flex; align-items: baseline; gap: var(--space-4); border-bottom: var(--border-width-thin) dotted var(--border2); padding-bottom: 6px; }
.cpub-sheet-ladder-tag { font-family: var(--font-mono); font-size: var(--text-label); color: var(--text-faint); width: 80px; flex-shrink: 0; }
.cpub-sheet-ladder-sample { font-family: var(--font-display); color: var(--text); line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: var(--font-weight-bold); }

.cpub-sheet-sublabel { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-faint); margin: var(--space-4) 0 var(--space-3); }
.cpub-sheet-space { display: flex; flex-direction: column; gap: var(--space-2); }
.cpub-sheet-space-row { display: flex; align-items: center; gap: var(--space-4); }
.cpub-sheet-space-tag { font-family: var(--font-mono); font-size: var(--text-label); color: var(--text-dim); width: 80px; flex-shrink: 0; }
.cpub-sheet-space-bar { height: 14px; background: var(--accent); min-width: 2px; }
.cpub-sheet-tiles { display: flex; gap: var(--space-4); flex-wrap: wrap; }
.cpub-sheet-tile { width: 96px; height: 64px; background: var(--surface); border: var(--border-width-thin) solid var(--border); display: grid; place-items: center; font-family: var(--font-mono); font-size: var(--text-label); text-transform: uppercase; color: var(--text-dim); }

@media (max-width: 760px) {
  .cpub-sheet-cgrid, .cpub-sheet-roles { grid-template-columns: 1fr; }
}
</style>
