import { z } from 'zod';

// --- Custom theme validators ---
// Custom themes are JSON-stored token maps that admins can author, import,
// export, and apply instance-wide. See docs/reference/theme-system.md.

/** Slug for a custom theme ID — kebab/snake, lowercase, used in data-theme attr. */
export const customThemeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Theme id must be alphanumeric with - or _');

/** Token name (without leading `--`). Permissive — we accept any kebab key
 *  so custom themes can introduce brand tokens (e.g. `deveco-portal-purple`)
 *  on top of the canonical TOKEN_NAMES list. */
export const themeTokenKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Token name must be alphanumeric with - or _');

/** Token value — any CSS value, length-capped to keep the JSON sane. */
export const themeTokenValueSchema = z.string().min(1).max(512);

/**
 * `--bg-image` is the one token whose value can FETCH (background-image
 * loads url() — a beacon/exfil channel the CSS sanitizer doesn't block, and
 * CSP is belt-not-suspenders). Allow only `none` or CSS gradients: no
 * quotes, no backslashes (kills CSS escapes like `\75rl(`), no `url`
 * substring anywhere (no legitimate gradient contains it — this also kills
 * protocol-relative `url(//host)` smuggles), and it must start with a
 * gradient function. Everything else about the value stays free-form.
 */
const SAFE_BG_IMAGE_RE = /^(none|(repeating-)?(linear|radial|conic)-gradient\([^"'\\]+\))$/i;
export function isSafeBgImageValue(value: string): boolean {
  const v = value.trim();
  return SAFE_BG_IMAGE_RE.test(v) && !/url/i.test(v);
}

export const themeTokenMapSchema = z
  .record(themeTokenKeySchema, themeTokenValueSchema)
  .superRefine((map, ctx) => {
    const v = map['bg-image'];
    if (v !== undefined && !isSafeBgImageValue(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bg-image'],
        message: 'bg-image must be "none" or a CSS gradient (url() and escapes are not allowed)',
      });
    }
  });
export type ThemeTokenMap = z.infer<typeof themeTokenMapSchema>;

/**
 * The generator "recipe" — the small set of inputs the @commonpub/theme-studio
 * wizard edits. Persisted alongside a theme so the wizard can be reopened
 * with its controls restored. Mirrors `ThemeRecipe` in @commonpub/theme-studio;
 * kept here as a bounded zod shape (the package re-validates on read).
 */
export const themeRecipeSchema = z.object({
  mode: z.enum(['light', 'dark']),
  accent: z.string().min(1).max(32),
  secondary: z.string().min(1).max(32).optional(),
  scheme: z.enum(['analogous', 'complementary', 'triadic', 'split', 'tetradic', 'monochrome']),
  fonts: z.object({
    display: z.string().min(1).max(80),
    body: z.string().min(1).max(80),
    ui: z.string().min(1).max(80),
    code: z.string().min(1).max(80),
  }),
  baseSize: z.number().min(8).max(32),
  ratio: z.number().min(1).max(3),
  spaceBase: z.union([z.literal(4), z.literal(8)]),
  density: z.enum(['compact', 'balanced', 'spacious']),
  shapeRadius: z.number().min(0).max(64),
  borderWidth: z.number().min(0).max(8),
  shadowStyle: z.enum(['none', 'hard', 'soft', 'glow', 'layered', 'neumorphic']),
  motion: z.enum(['sharp', 'snappy', 'smooth']),
  texture: z.number().min(0).max(0.2).optional().default(0),
  neutralHue: z.number().min(0).max(360).optional(),
  neutralSat: z.number().min(0).max(100).optional(),
  /** The design-ethos preset the recipe started from (UI convenience). */
  archetype: z.string().max(64).optional(),
  /** Surface treatment. Absent = solid surfaces (the legacy projection). */
  treatment: z
    .object({
      /** Glass strength 0-0.3: surface translucency + backdrop blur. */
      glass: z.number().min(0).max(0.3).optional(),
      /** Emit a subtle page gradient derived from bg + accent. */
      bgGradient: z.boolean().optional(),
    })
    .optional(),
});
export type ThemeRecipeInput = z.infer<typeof themeRecipeSchema>;

export const customThemeSchema = z.object({
  id: customThemeIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  family: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  isDark: z.boolean(),
  /** Optional sibling theme ID in the same family for the opposite mode. */
  pairId: customThemeIdSchema.optional(),
  /** Theme this one inherits from (built-in CSS or another custom). */
  parentTheme: z.string().min(1).max(64).default('base'),
  tokens: themeTokenMapSchema.default({}),
  /** Generator recipe (theme-studio). Absent for hand-authored themes. */
  recipe: themeRecipeSchema.optional(),
  /** Google-Font families to load when this theme is active. */
  fonts: z.array(z.string().min(1).max(80)).max(8).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type CustomThemeInput = z.infer<typeof customThemeSchema>;

/** PUT body — accepts partial updates. */
export const customThemeUpdateSchema = customThemeSchema.partial().required({ id: true });

/** Exported theme file format. Version bumped when the schema breaks. */
export const themeExportSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  theme: customThemeSchema,
});
export type ThemeExport = z.infer<typeof themeExportSchema>;
