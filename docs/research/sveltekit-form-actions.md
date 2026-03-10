# SvelteKit Form Actions vs API Routes for CRUD

## Question
Should content mutations use SvelteKit form actions or API routes?

## Analysis

### Form Actions (`+page.server.ts`)
- Progressive enhancement via `use:enhance` — works without JS
- Automatic CSRF protection (SvelteKit handles origin checking)
- Type-safe with `ActionData` — form errors flow back to the page
- Server-side validation runs before any mutation
- Redirects via `redirect()` helper
- File uploads via `FormData` parsing

### API Routes (`+server.ts`)
- Required for client-side AJAX (fetch from components)
- JSON request/response — better for toggle operations
- No built-in CSRF (must validate manually or use auth headers)
- Useful for operations that don't navigate (like/bookmark toggles)

### `use:enhance` Progressive Enhancement
```svelte
<form method="POST" action="?/create" use:enhance>
  <!-- Fields -->
</form>
```
- Prevents full-page reload when JS is available
- Submits as `FormData`, not JSON
- `ActionFailure` returns validation errors to the form
- Custom `enhance` callback for optimistic UI

### Error Handling Pattern
```typescript
// +page.server.ts
export const actions = {
  create: async ({ request, locals }) => {
    const data = await request.formData();
    const result = schema.safeParse(Object.fromEntries(data));
    if (!result.success) {
      return fail(400, { errors: result.error.flatten().fieldErrors });
    }
    // ... create content
    redirect(303, `/projects/${slug}`);
  }
};
```

## Conclusion

- **Form actions** for content CRUD mutations (create, update, delete, publish)
  - Progressive enhancement via `use:enhance`
  - Built-in CSRF protection
  - Server-side validation with `fail()` for errors
- **`+page.server.ts` load** for all read operations (SSR)
- **`+server.ts` JSON API** only for social interactions (like, bookmark, comment)
  - These are toggle operations from interactive components
  - Don't navigate, just update UI state
