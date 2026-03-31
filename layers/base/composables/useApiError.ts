// Consistent client-side error extraction from API responses

export function useApiError() {
  function extract(err: unknown): string {
    const e = err as {
      data?: {
        statusMessage?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };
      statusCode?: number;
      message?: string;
    };

    // Zod validation errors
    if (e?.data?.errors) {
      return Object.entries(e.data.errors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
        .join('; ');
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
