// Consistent client-side error extraction from API responses

export function useApiError() {
  function extract(err: unknown): string {
    const e = err as {
      data?: {
        statusMessage?: string;
        message?: string;
        errors?: Record<string, string[]>;
        // h3's error response nests `createError({ data })` under a `data` key of
        // the BODY, and $fetch sets FetchError.data to that whole body — so the
        // field errors a route raises as `data: { errors }` arrive at
        // `err.data.data.errors`, one level deeper than they look.
        data?: { errors?: Record<string, string[]> };
      };
      statusCode?: number;
      message?: string;
    };

    // Zod validation errors. Read BOTH shapes: `data.data.errors` is what h3
    // actually delivers (see above); `data.errors` is kept for any caller that
    // hands us an already-unwrapped payload. Reading only the shallow one is why
    // every validation failure in the app surfaced as a bare "Validation failed"
    // with no clue which field was at fault.
    const fieldErrors = e?.data?.data?.errors ?? e?.data?.errors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const parts = Object.entries(fieldErrors)
        .map(([field, msgs]) => `${field}: ${(Array.isArray(msgs) ? msgs : [String(msgs)]).join(', ')}`)
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }

    // Server error messages
    if (e?.data?.statusMessage) return e.data.statusMessage;
    if (e?.data?.message) return e.data.message;

    // Status code hints
    if (e?.statusCode === 401) return 'Not authenticated. Please log in again.';
    if (e?.statusCode === 403) return 'Permission denied.';
    if (e?.statusCode === 404) return 'Not found.';
    if (e?.statusCode === 429) return 'Too many requests. Please wait.';
    if (e?.statusCode === 500) return 'Server error. Please try again.';

    // Fallback
    if (e?.message) return e.message;
    return 'Something went wrong. Please try again.';
  }

  return { extract };
}
