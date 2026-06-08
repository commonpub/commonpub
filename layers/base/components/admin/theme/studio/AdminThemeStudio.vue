<script setup lang="ts">
/**
 * AdminThemeStudio — the guided theme generator (the "easy mode").
 *
 * A compact 4-step wizard (Color → Type → Shape → Feel) plus a dice roll.
 * It owns a `ThemeRecipe` and, on every change, re-derives the full
 * CommonPub token map via `recipeToTokens` and emits it. The parent editor
 * applies the emitted tokens/recipe/fonts to the SAME draft the granular
 * token editor edits — so Studio is a generator on top of the existing
 * editor, not a separate surface (see [[feedback_reuse_existing_components]]).
 *
 * One-way by design: touching a Studio control regenerates the token set.
 * Manual tweaks made in the advanced editor are overwritten if you change
 * Studio again — the parent shows a warning banner to that effect.
 */
import { computed, ref, watch } from 'vue';
import {
  type ThemeRecipe,
  recipeToTokens,
  randomizeRecipe,
  randomName,
  buildPalette,
  harmonyColors,
  contrast,
  wcag,
  COLOR_VIBES,
  TYPE_VIBES,
  SHAPE_PRESETS,
  SHADOW_PRESETS,
  RATIOS,
  FONTS,
  defaultRecipe,
  type HarmonyScheme,
} from '@commonpub/theme-studio';

const props = defineProps<{ recipe?: ThemeRecipe; name?: string }>();

const emit = defineEmits<{
  generate: [{
    recipe: ThemeRecipe;
    tokens: Record<string, string>;
    fonts: string[];
    parentTheme: 'base' | 'dark';
    isDark: boolean;
  }];
  finish: [{ apply: boolean }];
  roll: [{ name: string }];
  rename: [string];
}>();

const recipe = ref<ThemeRecipe>(props.recipe ? { ...props.recipe } : defaultRecipe());

const STEPS = [
  { kicker: 'Color', q: 'Pick a vibe, or your colors.' },
  { kicker: 'Type', q: 'Pick a type vibe, or fonts.' },
  { kicker: 'Shape', q: 'Rounded or sharp?' },
  { kicker: 'Feel', q: 'Spacing, density, texture, motion.' },
  { kicker: 'Finish', q: 'Name it and save.' },
] as const;
const step = ref(0);

const colorTab = ref<'vibe' | 'custom'>(props.recipe ? 'custom' : 'vibe');
const typeTab = ref<'vibe' | 'custom'>(props.recipe ? 'custom' : 'vibe');
const colorVibe = ref(0);
const typeVibe = ref(0);
const useSecondary = ref(Boolean(props.recipe?.secondary));
const applyDefault = ref(false);

const SCHEMES: { val: HarmonyScheme; label: string }[] = [
  { val: 'analogous', label: 'Analogous' },
  { val: 'complementary', label: 'Complement' },
  { val: 'triadic', label: 'Triadic' },
  { val: 'split', label: 'Split' },
  { val: 'tetradic', label: 'Tetradic' },
  { val: 'monochrome', label: 'Mono' },
];

// --- Emit on every change ---------------------------------------------

function emitGenerate(): void {
  const g = recipeToTokens(recipe.value);
  emit('generate', {
    recipe: { ...recipe.value },
    tokens: g.tokens,
    fonts: g.fonts,
    parentTheme: g.parentTheme,
    isDark: recipe.value.mode === 'dark',
  });
}
watch(recipe, emitGenerate, { deep: true });

// --- Live WCAG audit (reassurance + catch extreme hand-picks) ----------

const auditTokens = computed(() => recipeToTokens(recipe.value).tokens);
function band(fg: string, bg: string): { ratio: string; band: string; ok: boolean } {
  const r = contrast(fg, bg);
  const b = wcag(r);
  return { ratio: r.toFixed(1), band: b, ok: b !== 'FAIL' };
}
const auditText = computed(() => band(auditTokens.value['text']!, auditTokens.value['bg']!));
const auditLink = computed(() => band(auditTokens.value['color-link']!, auditTokens.value['bg']!));

// --- Vibe swatch + harmony-family previews ----------------------------

function miniPal(accent: string, scheme: HarmonyScheme, mode: 'light' | 'dark'): string[] {
  const p = buildPalette({ accent, scheme, mode }).sem;
  return [p.accent, p.secondary, p.surface2, p.bg];
}
function palStrip(accent: string, scheme: HarmonyScheme, mode: 'light' | 'dark'): string[] {
  const p = buildPalette({ accent, scheme, mode }).sem;
  return [p.bg, p.surface, p.accent, p.secondary, p.text];
}
/** The accent + its harmony companions — the "suggested family" strip. */
const familyStrip = computed<string[]>(() => [
  recipe.value.accent,
  ...harmonyColors(recipe.value.accent, recipe.value.scheme),
]);

// --- Color actions -----------------------------------------------------

function applyPalette(accent: string, scheme: HarmonyScheme, mode: 'light' | 'dark'): void {
  recipe.value.accent = accent;
  recipe.value.scheme = scheme;
  recipe.value.mode = mode;
  recipe.value.secondary = undefined;
  useSecondary.value = false;
}
function onAccentHex(v: string): void {
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) recipe.value.accent = v[0] === '#' ? v : `#${v}`;
}
function onSecondaryHex(v: string): void {
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) recipe.value.secondary = v[0] === '#' ? v : `#${v}`;
}
function toggleSecondary(): void {
  useSecondary.value = !useSecondary.value;
  recipe.value.secondary = useSecondary.value ? recipe.value.secondary ?? '#8b5cf6' : undefined;
}

/** Pull a dominant, vivid-ish accent out of an uploaded image (client-only). */
function onImagePick(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || typeof document === 'undefined') return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = (): void => {
    const cv = document.createElement('canvas');
    const w = (cv.width = 48);
    const h = (cv.height = 48);
    const ctx = cv.getContext('2d');
    URL.revokeObjectURL(url);
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let best: [number, number, number] | null = null;
    let bestScore = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!, a = d[i + 3]!;
      if (a < 200) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2 / 255;
      const sat = mx === mn ? 0 : (mx - mn) / 255;
      const score = sat * (1 - Math.abs(l - 0.5) * 1.1); // saturated + mid-light wins
      if (score > bestScore) { bestScore = score; best = [r, g, b]; }
    }
    if (best) {
      recipe.value.accent = '#' + best.map((c) => c.toString(16).padStart(2, '0')).join('');
    }
  };
  img.src = url;
}

// --- Type actions ------------------------------------------------------

function applyTypeSet(d: string, b: string, u: string, c: string): void {
  recipe.value.fonts = { display: d, body: b, ui: u, code: c };
}

// --- Dice --------------------------------------------------------------

function roll(): void {
  const seed = Date.now() >>> 0;
  recipe.value = randomizeRecipe(seed);
  colorTab.value = 'vibe';
  typeTab.value = 'vibe';
  useSecondary.value = Boolean(recipe.value.secondary);
  emit('roll', { name: randomName(seed) });
}

// --- Nav ---------------------------------------------------------------

const isLast = computed(() => step.value === STEPS.length - 1);
function next(): void {
  if (!isLast.value) step.value++;
}
function back(): void {
  if (step.value > 0) step.value--;
}
function finishWith(apply: boolean): void {
  emit('finish', { apply });
}
</script>

<template>
  <div class="cpub-studio">
    <header class="cpub-studio-head">
      <div class="cpub-studio-brand">
        <span class="cpub-studio-logo">STUDIO</span>
        <span class="cpub-studio-tagline">guided theme builder</span>
      </div>
      <button type="button" class="cpub-studio-dice" title="Roll a random theme" @click="roll">
        <i class="fa-solid fa-dice" aria-hidden="true" /> Roll
      </button>
    </header>

    <nav class="cpub-studio-stepper" aria-label="Studio steps">
      <button
        v-for="(s, i) in STEPS"
        :key="s.kicker"
        type="button"
        class="cpub-studio-step"
        :class="{ active: i === step, done: i < step }"
        :aria-current="i === step ? 'step' : undefined"
        @click="step = i"
      >{{ i + 1 }}</button>
    </nav>

    <div class="cpub-studio-stephead">
      <div class="cpub-studio-kicker">{{ STEPS[step].kicker }}</div>
      <div class="cpub-studio-q">{{ STEPS[step].q }}</div>
    </div>

    <div class="cpub-studio-body">
      <!-- STEP 1: COLOR -->
      <div v-if="step === 0">
        <div class="cpub-studio-tabs">
          <button type="button" :class="{ on: colorTab === 'vibe' }" @click="colorTab = 'vibe'">By vibe</button>
          <button type="button" :class="{ on: colorTab === 'custom' }" @click="colorTab = 'custom'">My colors</button>
        </div>

        <template v-if="colorTab === 'vibe'">
          <div class="cpub-studio-vgrid">
            <button
              v-for="(v, i) in COLOR_VIBES"
              :key="v.name"
              type="button"
              class="cpub-studio-vcard"
              :class="{ on: i === colorVibe }"
              @click="colorVibe = i; applyPalette(v.pals[0].a, v.pals[0].s, v.pals[0].mode)"
            >
              <span class="cpub-studio-vcard-name">{{ v.name }}</span>
              <span class="cpub-studio-dots">
                <span v-for="(d, di) in miniPal(v.pals[0].a, v.pals[0].s, v.pals[0].mode)" :key="di" :style="{ background: d }" />
              </span>
            </button>
          </div>
          <div class="cpub-studio-sublbl">Palettes / {{ COLOR_VIBES[colorVibe].name }}</div>
          <div class="cpub-studio-pallist">
            <button
              v-for="(p, i) in COLOR_VIBES[colorVibe].pals"
              :key="p.n"
              type="button"
              class="cpub-studio-palchip"
              :class="{ on: recipe.accent === p.a && recipe.scheme === p.s && recipe.mode === p.mode }"
              @click="applyPalette(p.a, p.s, p.mode)"
            >
              <span class="cpub-studio-palchip-name">{{ p.n }}</span>
              <span class="cpub-studio-palstrip">
                <span v-for="(c, ci) in palStrip(p.a, p.s, p.mode)" :key="ci" :style="{ background: c }" />
              </span>
            </button>
          </div>
        </template>

        <template v-else>
          <label class="cpub-studio-field">
            <span class="cpub-studio-lbl">Mode</span>
            <span class="cpub-studio-seg">
              <button type="button" :class="{ on: recipe.mode === 'light' }" @click="recipe.mode = 'light'">Light</button>
              <button type="button" :class="{ on: recipe.mode === 'dark' }" @click="recipe.mode = 'dark'">Dark</button>
            </span>
          </label>
          <label class="cpub-studio-field">
            <span class="cpub-studio-lbl">Accent <span class="cpub-studio-hint">from image…</span></span>
            <span class="cpub-studio-colorrow">
              <input type="color" :value="recipe.accent" class="cpub-studio-colorpick" @input="recipe.accent = ($event.target as HTMLInputElement).value" />
              <input type="text" :value="recipe.accent" maxlength="7" class="cpub-studio-input cpub-studio-mono" @input="onAccentHex(($event.target as HTMLInputElement).value)" />
              <label class="cpub-studio-imgbtn" title="Extract an accent from an image or logo">
                <i class="fa-solid fa-image" aria-hidden="true" />
                <input type="file" accept="image/*" hidden @change="onImagePick" />
              </label>
            </span>
          </label>
          <label class="cpub-studio-field">
            <span class="cpub-studio-lbl">Color family <span class="cpub-studio-hint">harmony</span></span>
            <span class="cpub-studio-seg cpub-studio-seg-wrap">
              <button v-for="sc in SCHEMES" :key="sc.val" type="button" :class="{ on: recipe.scheme === sc.val }" @click="recipe.scheme = sc.val">{{ sc.label }}</button>
            </span>
          </label>
          <div class="cpub-studio-field">
            <span class="cpub-studio-lbl">Suggested family</span>
            <span class="cpub-studio-family">
              <span v-for="(c, i) in familyStrip" :key="i" :style="{ background: c }" :title="c" />
            </span>
          </div>
          <div class="cpub-studio-toggle-line">
            <span class="cpub-studio-lbl">Hand-pick secondary</span>
            <button type="button" class="cpub-studio-switch" :class="{ on: useSecondary }" :aria-pressed="useSecondary" @click="toggleSecondary" />
          </div>
          <label v-if="useSecondary" class="cpub-studio-field">
            <span class="cpub-studio-colorrow">
              <input type="color" :value="recipe.secondary" class="cpub-studio-colorpick" @input="recipe.secondary = ($event.target as HTMLInputElement).value" />
              <input type="text" :value="recipe.secondary" maxlength="7" class="cpub-studio-input cpub-studio-mono" @input="onSecondaryHex(($event.target as HTMLInputElement).value)" />
            </span>
          </label>
        </template>
      </div>

      <!-- STEP 2: TYPE -->
      <div v-else-if="step === 1">
        <div class="cpub-studio-tabs">
          <button type="button" :class="{ on: typeTab === 'vibe' }" @click="typeTab = 'vibe'">By vibe</button>
          <button type="button" :class="{ on: typeTab === 'custom' }" @click="typeTab = 'custom'">Custom</button>
        </div>

        <template v-if="typeTab === 'vibe'">
          <div class="cpub-studio-vgrid">
            <button
              v-for="(v, i) in TYPE_VIBES"
              :key="v.name"
              type="button"
              class="cpub-studio-vcard"
              :class="{ on: i === typeVibe }"
              @click="typeVibe = i; applyTypeSet(v.sets[0].d, v.sets[0].b, v.sets[0].u, v.sets[0].c)"
            >
              <span class="cpub-studio-vcard-name">{{ v.name }}</span>
              <span class="cpub-studio-vcard-sub">{{ v.sets.length }} sets</span>
            </button>
          </div>
          <div class="cpub-studio-sublbl">Sets / {{ TYPE_VIBES[typeVibe].name }}</div>
          <div class="cpub-studio-setlist">
            <button
              v-for="(s, i) in TYPE_VIBES[typeVibe].sets"
              :key="i"
              type="button"
              class="cpub-studio-setchip"
              :class="{ on: recipe.fonts.display === s.d && recipe.fonts.body === s.b }"
              @click="applyTypeSet(s.d, s.b, s.u, s.c)"
            >
              <span class="cpub-studio-set-disp">{{ s.d }}</span>
              <span class="cpub-studio-set-meta"><span>{{ s.b }}</span><span>{{ s.u }}</span><span>{{ s.c }}</span></span>
            </button>
          </div>
        </template>

        <template v-else>
          <label v-for="role in ([['display','Display / headlines'],['body','Body / content'],['ui','UI / labels'],['code','Code / data']] as const)" :key="role[0]" class="cpub-studio-field">
            <span class="cpub-studio-lbl">{{ role[1] }}</span>
            <select :value="recipe.fonts[role[0]]" class="cpub-studio-input" @change="recipe.fonts[role[0]] = ($event.target as HTMLSelectElement).value">
              <optgroup v-for="(fams, grp) in FONTS" :key="grp" :label="grp">
                <option v-for="f in fams" :key="f" :value="f">{{ f }}</option>
              </optgroup>
            </select>
          </label>
        </template>

        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Base size <span class="cpub-studio-val">{{ recipe.baseSize }}px</span></span>
          <input type="range" min="13" max="19" :value="recipe.baseSize" class="cpub-studio-range" @input="recipe.baseSize = Number(($event.target as HTMLInputElement).value)" />
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Scale ratio</span>
          <span class="cpub-studio-seg cpub-studio-seg-wrap">
            <button v-for="r in RATIOS" :key="r.k" type="button" :class="{ on: recipe.ratio === r.k }" @click="recipe.ratio = r.k">{{ r.label }}</button>
          </span>
        </label>
      </div>

      <!-- STEP 3: SHAPE -->
      <div v-else-if="step === 2">
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Corner language</span>
          <span class="cpub-studio-seg cpub-studio-seg-wrap">
            <button v-for="sp in SHAPE_PRESETS" :key="sp.k" type="button" :class="{ on: recipe.shapeRadius === sp.r }" @click="recipe.shapeRadius = sp.r">{{ sp.label }}<small>{{ sp.sub }}</small></button>
          </span>
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Fine radius <span class="cpub-studio-val">{{ recipe.shapeRadius }}px</span></span>
          <input type="range" min="0" max="28" :value="recipe.shapeRadius" class="cpub-studio-range" @input="recipe.shapeRadius = Number(($event.target as HTMLInputElement).value)" />
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Border weight</span>
          <span class="cpub-studio-seg">
            <button v-for="bw in [1,2,3,4]" :key="bw" type="button" :class="{ on: recipe.borderWidth === bw }" @click="recipe.borderWidth = bw">{{ bw }}px</button>
          </span>
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Shadow style</span>
          <span class="cpub-studio-seg cpub-studio-seg-wrap">
            <button v-for="sh in SHADOW_PRESETS" :key="sh.k" type="button" :class="{ on: recipe.shadowStyle === sh.k }" @click="recipe.shadowStyle = sh.k">{{ sh.label }}<small>{{ sh.sub }}</small></button>
          </span>
        </label>
      </div>

      <!-- STEP 4: FEEL -->
      <div v-else-if="step === 3">
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Spacing base</span>
          <span class="cpub-studio-seg">
            <button type="button" :class="{ on: recipe.spaceBase === 4 }" @click="recipe.spaceBase = 4">4px<small>tight</small></button>
            <button type="button" :class="{ on: recipe.spaceBase === 8 }" @click="recipe.spaceBase = 8">8px<small>airy</small></button>
          </span>
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Density</span>
          <span class="cpub-studio-seg">
            <button v-for="d in (['compact','balanced','spacious'] as const)" :key="d" type="button" :class="{ on: recipe.density === d }" @click="recipe.density = d">{{ d }}</button>
          </span>
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Grain <span class="cpub-studio-val">{{ Math.round(recipe.texture * 100) }}%</span></span>
          <input type="range" min="0" max="12" :value="Math.round(recipe.texture * 100)" class="cpub-studio-range" @input="recipe.texture = Number(($event.target as HTMLInputElement).value) / 100" />
        </label>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Motion</span>
          <span class="cpub-studio-seg">
            <button v-for="m in (['sharp','snappy','smooth'] as const)" :key="m" type="button" :class="{ on: recipe.motion === m }" @click="recipe.motion = m">{{ m }}</button>
          </span>
        </label>
      </div>

      <!-- STEP 5: FINISH -->
      <div v-else>
        <label class="cpub-studio-field">
          <span class="cpub-studio-lbl">Theme name</span>
          <input
            type="text"
            :value="props.name"
            class="cpub-studio-input"
            placeholder="My theme"
            @input="emit('rename', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <div class="cpub-studio-toggle-line">
          <span class="cpub-studio-lbl">Save &amp; apply as the site default</span>
          <button type="button" class="cpub-studio-switch" :class="{ on: applyDefault }" :aria-pressed="applyDefault" @click="applyDefault = !applyDefault" />
        </div>
        <p class="cpub-studio-note">
          Studio saves a matching light + dark pair, each tuned for its mode. After saving you can
          re-open Studio any time, or fine-tune individual tokens in the advanced editor.
        </p>
        <button type="button" class="cpub-btn cpub-btn-primary cpub-studio-save" @click="finishWith(applyDefault)">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true" /> {{ applyDefault ? 'Save & apply theme' : 'Save theme' }}
        </button>
      </div>
    </div>

    <footer class="cpub-studio-foot">
      <button type="button" class="cpub-btn cpub-btn-sm" :disabled="step === 0" @click="back">
        <i class="fa-solid fa-arrow-left" aria-hidden="true" /> Back
      </button>
      <span class="cpub-studio-audit" :title="`text ${auditText.ratio}:1, links ${auditLink.ratio}:1`">
        <span class="cpub-studio-chip" :class="auditText.ok ? 'ok' : 'bad'">text {{ auditText.band }}</span>
        <span class="cpub-studio-chip" :class="auditLink.ok ? 'ok' : 'bad'">links {{ auditLink.band }}</span>
      </span>
      <button v-if="!isLast" type="button" class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="next">
        Next <i class="fa-solid fa-arrow-right" aria-hidden="true" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.cpub-studio { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--surface); }

.cpub-studio-head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-bottom: var(--border-width-default) solid var(--border); }
.cpub-studio-logo { font-family: var(--font-mono); font-weight: var(--font-weight-bold); letter-spacing: var(--tracking-widest); font-size: var(--text-md); }
.cpub-studio-tagline { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-faint); margin-left: var(--space-2); }
.cpub-studio-dice { display: inline-flex; align-items: center; gap: 6px; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); color: var(--text-dim); font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; padding: 6px 10px; cursor: pointer; }
.cpub-studio-dice:hover { border-color: var(--accent); color: var(--accent); }

.cpub-studio-stepper { display: flex; gap: var(--space-1); padding: var(--space-3) var(--space-4) 0; }
.cpub-studio-step { flex: 1; height: 28px; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); color: var(--text-faint); font-family: var(--font-mono); font-weight: var(--font-weight-bold); font-size: var(--text-sm); cursor: pointer; }
.cpub-studio-step.done { color: var(--text-dim); }
.cpub-studio-step.active { background: var(--accent); color: var(--color-on-accent); border-color: var(--accent); }

.cpub-studio-stephead { padding: var(--space-3) var(--space-4) 0; }
.cpub-studio-kicker { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--accent); }
.cpub-studio-q { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-top: 4px; }

.cpub-studio-body { flex: 1; overflow-y: auto; min-height: 0; padding: var(--space-3) var(--space-4) var(--space-5); }

.cpub-studio-tabs { display: flex; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); padding: 2px; margin-bottom: var(--space-3); }
.cpub-studio-tabs button { flex: 1; padding: 6px; background: none; border: 0; font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-bold); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-faint); cursor: pointer; }
.cpub-studio-tabs button.on { background: var(--surface); color: var(--text); }

.cpub-studio-vgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.cpub-studio-vcard { display: flex; flex-direction: column; gap: 6px; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); padding: var(--space-2); cursor: pointer; text-align: left; }
.cpub-studio-vcard:hover { border-color: var(--text-faint); }
.cpub-studio-vcard.on { border-color: var(--accent); background: var(--accent-bg); }
.cpub-studio-vcard-name { font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-bold); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text); }
.cpub-studio-vcard-sub { font-size: var(--text-label); color: var(--text-faint); }
.cpub-studio-dots { display: flex; gap: 3px; }
.cpub-studio-dots span { flex: 1; height: 14px; }

.cpub-studio-sublbl { font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-faint); margin: var(--space-4) 0 var(--space-2); }
.cpub-studio-pallist, .cpub-studio-setlist { display: flex; flex-direction: column; gap: 6px; }
.cpub-studio-palchip { display: flex; align-items: center; gap: var(--space-2); background: var(--surface2); border: var(--border-width-thin) solid var(--border2); padding: 6px 8px; cursor: pointer; }
.cpub-studio-palchip:hover { border-color: var(--text-faint); }
.cpub-studio-palchip.on { border-color: var(--accent); background: var(--accent-bg); }
.cpub-studio-palchip-name { font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-semibold); text-transform: uppercase; width: 76px; flex-shrink: 0; color: var(--text-dim); }
.cpub-studio-palstrip { display: flex; flex: 1; height: 20px; overflow: hidden; }
.cpub-studio-palstrip span { flex: 1; }

.cpub-studio-setchip { display: flex; flex-direction: column; gap: 2px; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); padding: var(--space-2); cursor: pointer; text-align: left; }
.cpub-studio-setchip:hover { border-color: var(--text-faint); }
.cpub-studio-setchip.on { border-color: var(--accent); background: var(--accent-bg); }
.cpub-studio-set-disp { font-size: var(--text-md); color: var(--text); }
.cpub-studio-set-meta { display: flex; gap: 4px; flex-wrap: wrap; }
.cpub-studio-set-meta span { font-family: var(--font-mono); font-size: var(--text-label); color: var(--text-faint); background: var(--surface3); padding: 1px 5px; }

.cpub-studio-field { display: block; margin-top: var(--space-3); }
.cpub-studio-field:first-child { margin-top: 0; }
.cpub-studio-lbl { display: block; font-family: var(--font-mono); font-size: var(--text-label); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; }
.cpub-studio-val { float: right; color: var(--accent); text-transform: none; }

.cpub-studio-input { width: 100%; background: var(--surface2); border: var(--border-width-thin) solid var(--border2); color: var(--text); font-family: var(--font-body); font-size: var(--text-sm); padding: 7px 9px; }
.cpub-studio-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.cpub-studio-mono { font-family: var(--font-mono); }

.cpub-studio-colorrow { display: flex; gap: var(--space-2); align-items: center; }
.cpub-studio-colorpick { width: 40px; height: 36px; padding: 0; border: var(--border-width-thin) solid var(--border2); background: none; cursor: pointer; flex-shrink: 0; }

.cpub-studio-seg { display: grid; gap: 4px; grid-auto-flow: column; grid-auto-columns: 1fr; }
.cpub-studio-seg-wrap { grid-auto-flow: row; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); }
.cpub-studio-seg button { background: var(--surface2); border: var(--border-width-thin) solid var(--border2); color: var(--text-dim); font-family: var(--font-mono); font-size: var(--text-label); font-weight: var(--font-weight-semibold); padding: 7px 4px; cursor: pointer; text-align: center; line-height: 1.2; }
.cpub-studio-seg button small { display: block; font-size: 8px; color: var(--text-faint); font-weight: var(--font-weight-normal); margin-top: 1px; text-transform: uppercase; }
.cpub-studio-seg button:hover { border-color: var(--text-faint); color: var(--text); }
.cpub-studio-seg button.on { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }

.cpub-studio-range { width: 100%; }
.cpub-studio-range:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.cpub-studio-note { font-size: var(--text-sm); color: var(--text-dim); line-height: var(--leading-snug); margin: var(--space-4) 0 0; }
.cpub-studio-hint { float: right; color: var(--text-faint); text-transform: none; letter-spacing: 0; }

.cpub-studio-imgbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; border: var(--border-width-thin) solid var(--border2); background: var(--surface2); color: var(--text-dim); cursor: pointer; }
.cpub-studio-imgbtn:hover { border-color: var(--accent); color: var(--accent); }

.cpub-studio-family { display: flex; height: 26px; border: var(--border-width-thin) solid var(--border2); overflow: hidden; }
.cpub-studio-family span { flex: 1; }

/* hand-pick secondary toggle */
.cpub-studio-toggle-line { display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-3); }
.cpub-studio-toggle-line .cpub-studio-lbl { margin-bottom: 0; }
.cpub-studio-switch { position: relative; width: 38px; height: 20px; background: var(--surface3); border: var(--border-width-thin) solid var(--border2); cursor: pointer; flex-shrink: 0; }
.cpub-studio-switch::after { content: ''; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px; background: var(--text-faint); transition: transform var(--transition-fast); }
.cpub-studio-switch.on { background: var(--accent-bg); border-color: var(--accent); }
.cpub-studio-switch.on::after { transform: translateX(18px); background: var(--accent); }

.cpub-studio-save { width: 100%; justify-content: center; margin-top: var(--space-4); }

.cpub-studio-foot { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-top: var(--border-width-default) solid var(--border); }
.cpub-studio-audit { display: flex; gap: 4px; margin-left: auto; }
.cpub-studio-chip { font-family: var(--font-mono); font-size: 9px; font-weight: var(--font-weight-bold); letter-spacing: var(--tracking-wide); text-transform: uppercase; padding: 2px 6px; border: var(--border-width-thin) solid; }
.cpub-studio-chip.ok { color: var(--green); border-color: var(--green); }
.cpub-studio-chip.bad { color: var(--red); border-color: var(--red); }
.cpub-studio-foot .cpub-btn-primary { margin-left: var(--space-2); }
</style>
