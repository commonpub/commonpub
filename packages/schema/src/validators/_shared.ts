import { z } from 'zod';

/** Optional URL field that also accepts empty strings (treated as undefined) */
export const optionalUrl = (maxLen?: number) => {
  const base = maxLen ? z.string().url().max(maxLen) : z.string().url();
  return z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    base.optional(),
  );
};
