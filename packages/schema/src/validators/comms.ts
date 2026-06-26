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

// Admin broadcast (email Phase 3). Body is PLAIN TEXT (rendered as escaped
// paragraphs) plus an optional themed CTA button with an http(s) URL — no
// operator-supplied HTML, so there is no injection surface.
export const broadcastAudienceSchema = z.union([
  z.literal('all'),
  z.object({ role: z.enum(['member', 'pro', 'verified', 'staff', 'admin']) }).strict(),
  z.object({ userIds: z.array(z.string().uuid()).min(1).max(1000) }).strict(),
]);

export const broadcastInputSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    bodyText: z.string().trim().min(1).max(5000),
    ctaLabel: z.string().trim().max(60).optional(),
    ctaUrl: z
      .string()
      .url()
      .max(500)
      .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL')
      .optional(),
    audience: broadcastAudienceSchema,
  })
  .strict()
  // A CTA needs both label and URL, or neither.
  .refine((v) => (v.ctaLabel ? !!v.ctaUrl : !v.ctaUrl), {
    message: 'A call-to-action needs both a label and a URL',
    path: ['ctaUrl'],
  });

export type BroadcastInput = z.infer<typeof broadcastInputSchema>;
export type BroadcastAudience = z.infer<typeof broadcastAudienceSchema>;

// Logged-in consent recording (GDPR Phase 2). `terms` = re-accept the Terms;
// `cookies` = record a cookie-consent choice. The version is server-supplied.
export const consentInputSchema = z.object({ kind: z.enum(['terms', 'cookies']) }).strict();
export type ConsentInput = z.infer<typeof consentInputSchema>;
