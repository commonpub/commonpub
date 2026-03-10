import { z } from 'zod';

export const textContentSchema = z.object({
  html: z.string(),
});
export type TextContent = z.infer<typeof textContentSchema>;

export const headingContentSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type HeadingContent = z.infer<typeof headingContentSchema>;

export const codeContentSchema = z.object({
  code: z.string(),
  language: z.string(),
  filename: z.string().optional(),
});
export type CodeContent = z.infer<typeof codeContentSchema>;

export const imageContentSchema = z.object({
  src: z.string().url(),
  alt: z.string(),
  caption: z.string().optional(),
});
export type ImageContent = z.infer<typeof imageContentSchema>;

export const quoteContentSchema = z.object({
  html: z.string(),
  attribution: z.string().optional(),
});
export type QuoteContent = z.infer<typeof quoteContentSchema>;

export const calloutContentSchema = z.object({
  html: z.string(),
  variant: z.enum(['info', 'tip', 'warning', 'danger']),
});
export type CalloutContent = z.infer<typeof calloutContentSchema>;
