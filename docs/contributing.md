# Contributing to CommonPub

## Getting Started

```bash
# Clone the repo
git clone https://github.com/commonpub/commonpub.git
cd commonpub

# Install dependencies
pnpm install

# Start local infrastructure
docker compose -f deploy/docker-compose.yml up -d

# Copy env
cp .env.example .env

# Build all packages
pnpm build

# Run tests
pnpm test

# Start dev
pnpm dev
```

## Development Workflow

1. Create a feature branch: `git checkout -b feat/description`
2. Write tests first (TDD)
3. Implement the feature
4. Run `pnpm typecheck && pnpm lint && pnpm test`
5. Commit with conventional commit message
6. Open PR with summary and test plan

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(schema): add learning path tables
fix(auth): handle expired magic links
test(editor): add block reordering tests
docs(adr): document search architecture
chore(deps): update drizzle-orm to 0.39
```

## Code Standards

See [coding-standards.md](./coding-standards.md) for detailed guidelines.

Key rules:

- TypeScript strict mode, no `any`
- Tests first, then implementation
- WCAG 2.1 AA accessibility minimum
- CSS custom properties only — no hardcoded colors/fonts
- Feature flags for all new features

## Package Structure

Each package follows:

```
packages/name/
  src/
    index.ts          # Public exports
    *.ts              # Implementation
    __tests__/        # Tests
  package.json
  tsconfig.json
  vitest.config.ts
```

## Testing

- **Unit**: Vitest for validators, config, business logic
- **Component**: @testing-library/svelte + axe-core for UI
- **Integration**: Vitest + test Postgres for API routes
- **E2E**: Playwright for user journeys

## Questions?

Open an issue on GitHub.
