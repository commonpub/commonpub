import { z } from 'zod';
import { optionalUrl } from './_shared.js';

// --- Product validators ---

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  category: z
    .enum([
      'microcontroller',
      'sbc',
      'sensor',
      'actuator',
      'display',
      'communication',
      'power',
      'mechanical',
      'software',
      'tool',
      'other',
    ])
    .optional(),
  specs: z.record(z.string(), z.string()).optional(),
  imageUrl: optionalUrl(),
  purchaseUrl: optionalUrl(),
  datasheetUrl: optionalUrl(),
  pricing: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().max(3).optional(),
    })
    .optional(),
  status: z.enum(['active', 'discontinued', 'preview']).default('active'),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addContentProductSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  role: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
  required: z.boolean().default(true),
});
export type AddContentProductInput = z.infer<typeof addContentProductSchema>;

export const productStatusSchema = z.enum(['active', 'discontinued', 'preview']);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productCategorySchema = z.enum([
  'microcontroller', 'sbc', 'sensor', 'actuator', 'display',
  'communication', 'power', 'mechanical', 'software', 'tool', 'other',
]);
export type ProductCategory = z.infer<typeof productCategorySchema>;
