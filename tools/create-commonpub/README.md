# create-commonpub

Rust CLI for scaffolding new CommonPub instances. Generates a Nuxt 3 project with all configuration, Docker setup, and package dependencies.

## Installation

```bash
cargo install create-commonpub
```

## Usage

### Interactive Setup

```bash
create-commonpub new my-community
```

Prompts for:
- Instance name and domain
- Description
- Feature flags (10 interactive prompts: content, social, hubs, docs, video, contests, learning, explainers, federation, admin)
- Content types (project, article, blog, explainer)
- Auth methods (email-password, magic-link, passkeys, GitHub, Google)
- Contest creation level (open, staff, admin)
- Theme selection (base, deepwood, hackbuild, deveco)
- Docker Compose generation

### Non-Interactive

```bash
create-commonpub new my-community --defaults
```

Generates a project with sensible defaults (core features enabled, email/password auth, local Docker Postgres).

### Initialize in Existing Directory

```bash
cd my-project
create-commonpub init
```

## CLI Flags

All flags can be combined with `--defaults` or used on their own to override interactive prompts.

| Flag | Description | Example |
|------|-------------|---------|
| `--defaults` | Skip prompts, use defaults | `create-commonpub new x --defaults` |
| `--features` | Comma-separated features to enable | `--features content,social,hubs,docs` |
| `--content-types` | Comma-separated content types | `--content-types project,article,blog` |
| `--auth` | Comma-separated auth methods | `--auth email-password,github` |
| `--contest-creation` | Contest creation level | `--contest-creation staff` |
| `--theme` | Theme preset | `--theme deepwood` |
| `--domain` | Instance domain | `--domain makers.example.com` |
| `--description` | Instance description | `--description "A maker community"` |
| `--no-docker` | Skip Docker Compose generation | `--no-docker` |

### Feature Flags

Available features: `content`, `social`, `hubs`, `docs`, `video`, `contests`, `learning`, `explainers`, `federation`, `admin`.

Features are disabled via runtime config flags, not file stripping. All `@commonpub/*` packages are installed — disabled features are invisible in UI but can be re-enabled later by setting environment variables.

### Content Types

Available types: `project`, `article`, `blog`, `explainer`.

## Generated Project Structure

The generated project extends `@commonpub/layer`, so it only needs minimal files:

```
my-community/
  package.json            # Dependencies (@commonpub/layer + @commonpub/config)
  nuxt.config.ts          # Extends @commonpub/layer
  commonpub.config.ts     # Instance name, domain, feature flags, auth
  tsconfig.json           # TypeScript config
  server/utils/config.ts  # Server-side config with env var overrides
  components/SiteLogo.vue # Custom branding (override)
  assets/theme.css        # Theme CSS variable overrides
  public/favicon.svg      # Site favicon
  uploads/                # Local file upload directory
  .env                    # Environment variables (if Docker enabled)
  docker-compose.yml      # Postgres + Redis + Meilisearch (if Docker enabled)
```

All pages, components, composables, API routes, and middleware come from the layer.

## Architecture Note

The current CLI generates Nuxt 3 projects from Rust string templates. A Phase 3 rearchitecture (copy-and-patch approach, embedding the reference app) is planned to improve output quality.

## Development

```bash
# Build
cargo build

# Run tests
cargo test

# Lint
cargo clippy
```

## Module Architecture

| Module      | File           | Purpose                                    |
| ----------- | -------------- | ------------------------------------------ |
| CLI         | `main.rs`      | Clap argument parser, subcommands          |
| Library     | `lib.rs`       | Public API for programmatic use            |
| Prompts     | `prompts.rs`   | Interactive prompts via dialoguer          |
| Scaffold    | `scaffold.rs`  | Directory creation and file writing        |
| Template    | `template.rs`  | Template rendering for config files        |

## Dependencies

- `clap`: CLI argument parsing
- `dialoguer`: Interactive terminal prompts
- `console`: Terminal styling
- `indicatif`: Progress bars
- `toml`: Config file parsing

## Test Dependencies

- `tempfile`: Temporary directories for integration tests
- `assert_cmd`: CLI assertion testing
- `predicates`: Output matching
