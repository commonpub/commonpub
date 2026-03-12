# create-commonpub

Rust CLI for scaffolding new CommonPub instances.

## Overview

Generates a ready-to-deploy CommonPub project with all configuration files, Docker setup, and package dependencies. Supports both interactive prompts and headless defaults.

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
- Feature flags (which modules to enable)
- Auth providers (GitHub, Google, email/password)
- Database connection details

### Non-Interactive

```bash
create-commonpub new my-community --defaults
```

Generates a project with sensible defaults (all core features enabled, email/password auth, local Docker Postgres).

### Initialize in Existing Directory

```bash
cd my-project
create-commonpub init
```

## Generated Project Structure

```
my-community/
  .env                    # Environment variables
  commonpub.config.ts      # Instance configuration
  docker-compose.yml      # Local Postgres + Redis + Meilisearch
  package.json            # Dependencies and scripts
  tsconfig.json           # TypeScript config
  svelte.config.js        # SvelteKit config
  vite.config.ts          # Vite config
  src/
    routes/               # SvelteKit routes
    hooks.server.ts       # Auth + security hooks
    app.html              # HTML template
```

## Development

```bash
# Build
cargo build

# Run tests
cargo test

# Lint
cargo clippy
```

## Architecture

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
