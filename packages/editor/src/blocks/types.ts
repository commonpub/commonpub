import type { z, ZodType } from 'zod';

/** A block is a [type, content] tuple */
export type BlockTuple = [string, Record<string, unknown>];

/** Definition for a registered block type */
export interface BlockDefinition<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique block type identifier (e.g., 'text', 'heading', 'code') */
  type: string;
  /** Zod schema for validating block content */
  schema: ZodType<T>;
  /** Human-readable label for the block type */
  label: string;
}
