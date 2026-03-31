/**
 * Publish validation composable — checks required fields before publishing content.
 * Returns an array of human-readable error strings. Empty array = ready to publish.
 */
import type { BlockTuple } from '@commonpub/editor';

export interface PublishValidationOptions {
  title: Ref<string>;
  metadata: Ref<Record<string, unknown>>;
  getBlockTuples: () => BlockTuple[];
  /** Override which fields are required. Defaults to title, description, cover, tags, content. */
  requiredFields?: Array<'title' | 'description' | 'coverImageUrl' | 'tags' | 'content'>;
}

export interface PublishValidationReturn {
  errors: Ref<string[]>;
  showErrors: Ref<boolean>;
  /** Run validation and return errors. Also updates errors ref. */
  validate: () => string[];
  /** Dismiss the error modal */
  dismiss: () => void;
}

const DEFAULT_REQUIRED: Array<'title' | 'description' | 'coverImageUrl' | 'tags' | 'content'> = [
  'title', 'description', 'coverImageUrl', 'tags', 'content',
];

export function usePublishValidation(opts: PublishValidationOptions): PublishValidationReturn {
  const errors = ref<string[]>([]);
  const showErrors = ref(false);
  const required = opts.requiredFields ?? DEFAULT_REQUIRED;

  function validate(): string[] {
    const errs: string[] = [];

    if (required.includes('title') && !opts.title.value.trim()) {
      errs.push('Title is required');
    }
    if (required.includes('description') && !(opts.metadata.value.description as string)?.trim()) {
      errs.push('Description is required');
    }
    if (required.includes('coverImageUrl') && !(opts.metadata.value.coverImageUrl as string)?.trim()) {
      errs.push('Cover image is required');
    }
    if (required.includes('tags')) {
      const tags = opts.metadata.value.tags as string[];
      if (!tags || tags.length === 0) {
        errs.push('At least one tag is required');
      }
    }
    if (required.includes('content') && opts.getBlockTuples().length === 0) {
      errs.push('Content is empty — add at least one block');
    }

    errors.value = errs;
    if (errs.length > 0) showErrors.value = true;
    return errs;
  }

  function dismiss(): void {
    showErrors.value = false;
  }

  return { errors, showErrors, validate, dismiss };
}
