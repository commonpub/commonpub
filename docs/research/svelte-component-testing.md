# Research: Svelte 5 Component Testing

## Date: 2026-03-09

## Question

How to test Svelte 5 components with runes using Vitest, @testing-library/svelte, and axe-core?

## Findings

### Testing Stack

| Tool | Purpose | Version |
|------|---------|---------|
| `vitest` | Test runner | ^3.0.0 |
| `@testing-library/svelte` | Component rendering + queries | ^5.0.0 |
| `@testing-library/jest-dom` | DOM matchers (toBeVisible, toHaveAttribute) | ^6.0.0 |
| `vitest-axe` | axe-core accessibility assertions | ^1.0.0 |
| `@sveltejs/vite-plugin-svelte` | Svelte compilation in Vitest | ^5.0.0 |
| `jsdom` | DOM environment | ^25.0.0 |

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

### Setup File

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
```

### Svelte 5 Runes + Testing Library

Testing Library's `render()` works with Svelte 5 components using `$props()`:

```typescript
import { render, screen } from '@testing-library/svelte';
import Button from '../Button.svelte';

test('renders button text', () => {
  render(Button, { props: { children: 'Click me' } });
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

For components using snippets (`{@render children()}`), wrap in a test harness component or use the `props` approach with Svelte 5's component API.

### Accessibility Testing with vitest-axe

```typescript
import { axe } from 'vitest-axe';

test('passes accessibility audit', async () => {
  const { container } = render(Button, { props: { children: 'Click' } });
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Key Patterns

1. **Query by role** — `screen.getByRole('button')`, `screen.getByRole('textbox')` — matches ARIA semantics
2. **User events** — `@testing-library/user-event` for realistic interactions (click, type, keyboard)
3. **Async queries** — `screen.findByRole()` for elements that appear after state changes
4. **Within** — `within(container).getByRole()` for scoped queries
5. **Snippets/slots** — For testing children content, create wrapper test components

### Gotchas

- `@sveltejs/vite-plugin-svelte` must be in vitest config's `plugins` array
- `hot: false` required in test mode (no HMR in jsdom)
- Svelte 5 component instantiation changed — `mount()` replaces `new Component()`
- `@testing-library/svelte` v5 handles this internally

## Sources

- @testing-library/svelte documentation
- Svelte 5 migration guide
- vitest-axe documentation
- axe-core rule descriptions
