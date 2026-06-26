import { z } from 'zod';

// Email branding (email Phase 2). Validated on write so a stored value can never
// inject markup or arbitrary CSS into rendered emails. Persisted in
// `instance_settings['email.branding']`. `.strict()` rejects unknown keys.
export const emailBrandingSchema = z
  .object({
    // Header band + action-button color. Strict #rrggbb so it can't smuggle CSS.
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a #rrggbb hex color')
      .optional(),
    headerText: z.string().trim().max(80).optional(),
    // http/https only — blocks javascript:/data: URIs in the logo image.
    logoUrl: z
      .string()
      .url()
      .max(500)
      .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL')
      .optional(),
    footerText: z.string().trim().max(300).optional(),
  })
  .strict();

export type EmailBrandingInput = z.infer<typeof emailBrandingSchema>;
