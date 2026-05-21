# Instance self-update — admin-driven `@commonpub/*` upgrades

**Status**: design, awaiting maintainer approval. Written 2026-05-21.

User-facing goal: an instance operator opens `/admin/updates`, sees
"Update available: layer 0.21.20 → 0.21.21", clicks **Update Now**,
and the instance pulls the new versions, runs DB migrations, and
restarts — all without the operator touching a terminal, editing
`package.json`, or watching CI logs.

## Why

Today, updating a thin-app instance is hands-on:

1. Operator (or maintainer-on-call) edits `package.json` to bump
   `@commonpub/layer` and — if `@commonpub/server` crossed minor —
   the matching `@commonpub/server` pin (the lockstep rule).
2. `pnpm install` to refresh `pnpm-lock.yaml`.
3. `git commit + git push` to the deploy repo.
4. GitHub Actions builds the new Docker image.
5. Deploy workflow SSHes to the droplet, `docker compose up -d`,
   `scripts/db-migrate.mjs` applies pending migrations on container
   boot.

Risks that the manual flow currently lives with:

- Operator forgets the lockstep rule and ships only the `layer` pin
  bump → consumer breakage when server crosses minor (session 149's
  `contentImport` regression was this class of bug).
- Operator doesn't know there's a security advisory in the new
  version → instance stays exposed.
- Operator misses release notes → schema migration surprises.
- Transient deploy flakes (npm ECONNRESET, SSH handshake reset) leave
  an operator-facing "deploy failed" with no easy retry — most
  operators don't know about `gh run rerun --failed`.
- Multi-instance operators (someone running both deveco-style + a
  hackerspace fork) repeat the same dance per repo.

The flow rarely scales beyond "the maintainer is also the operator."
For CommonPub to be genuinely self-hostable by less-technical
community admins, **clicking a button in the admin panel** is the
target UX.

## Constraints / non-goals

- **commonpub.io is NOT a target**. It builds from workspace source,
  not from npm. `pnpm-lock.yaml` is the monorepo's, not a thin-app's.
  Self-update is a thin-app feature.
- **No new infrastructure**. Operators already run on DigitalOcean
  droplets with `docker-compose + Caddy + GitHub Actions deploy`.
  The feature must leverage that.
- **No silent migration changes**. Operators must see "this update
  includes N new schema migrations" before clicking.
- **Reversibility**. If an update goes bad, operator needs a clear
  rollback path.
- **Phase 1 = layer + server**. Other packages (config, schema,
  ui, editor, etc.) are transitive — bumping layer + server pulls
  them in. Direct per-package picker is Phase 2+.
- **Admin-only**. Single shared admin in v1 (no per-instance role
  delegation for updates).

## Approaches considered

### A. GitHub Actions `workflow_dispatch` (chosen for Phase 1)

Admin clicks → backend calls GitHub REST `POST
/repos/:owner/:repo/actions/workflows/update.yml/dispatches` with
`inputs: { version: "0.21.21" }`. The workflow runs in GitHub:

1. Checks out the operator's repo.
2. Bumps `@commonpub/layer` pin in `package.json` to the requested
   version.
3. Looks up the matching `@commonpub/server` version from npm dist-tag
   `latest` (or the operator can pin `version-set: "compatible"`),
   bumps that pin too if it crossed minor since the last update.
4. Runs `pnpm install` to refresh the lockfile.
5. Commits `chore(deps): bump @commonpub/layer ^X.Y.Z (+ server if
   crossed)` and pushes to `main`.
6. The push triggers the existing `Deploy Production` workflow which
   builds + ships.

Admin panel polls the workflow run status via
`GET /repos/:owner/:repo/actions/runs/:id` for the bump-and-push
run, then polls the deploy run, then verifies `/api/health` =
200 with the new version (read from the `@commonpub/layer`
package.json the server bundles).

**Why this approach wins:**
- Reuses the existing CI/CD pipeline. Zero new infra.
- The bump is a real git commit — auditable, revertable via
  `git revert` and another deploy.
- The bump + lockfile happens in GitHub's runner (which has node +
  pnpm + the operator's full repo) — the backend doesn't need to
  reproduce the build environment.
- Schema migrations apply via the existing `scripts/db-migrate.mjs`
  on container boot — no special path.

**Caveats:**
- Requires `GITHUB_REPO=owner/repo` + `GITHUB_TOKEN` (PAT with
  `repo` + `workflow` scopes) configured per instance. Operators
  on non-GitHub Git hosts (GitLab, etc.) get a clear "self-update
  not configured" message.
- Operators on the one-click DO App Platform deploy don't have a
  separate repo workflow — for them, self-update could instead
  dispatch a DO App Platform redeploy via DO API. Out of scope for
  Phase 1.

### B. In-container `pnpm update` + restart

Backend runs `pnpm update @commonpub/layer @commonpub/server` inside
the running container, then sends `SIGTERM` to Nitro to trigger a
graceful restart.

**Rejected because:**
- Docker images are ideally immutable. Modifying a running container
  is anti-pattern; the next image deploy clobbers the change.
- pnpm install in a running container can fail in many ways (disk
  space, registry connectivity, native module rebuilds).
- No git commit → no audit trail → no rollback.
- DB migrations would need a separate trigger.

### C. Generate a PR

Backend uses GitHub API to create a branch + open a PR with the
bump. Operator reviews + merges.

**Rejected for Phase 1** (great for Phase 2):
- Adds a manual gate that defeats "click button to update" UX. For
  a maintainer team that wants review gates, this is desirable; for
  a solo hackerspace operator, it's friction.
- Phase 2 could offer this as a config option:
  `instanceUpdates.requireApproval: true → open PR; false → push directly`.

### D. Docker image polling (Watchtower)

Image-registry-based auto-update. Watchtower polls Docker Hub for
new tags and recreates containers.

**Rejected because:**
- CommonPub thin-apps build per-instance images (each operator's repo
  has its own config/secrets baked in). There's no shared `latest`
  tag on a registry.
- Operator-side ops burden (run Watchtower as a separate container).

## Phase 1 implementation plan

### Schema

No schema migrations needed in Phase 1. Optional: `instance_settings`
JSONB gains a `lastUpdate` sub-object recording the last successful
update:

```ts
instance_settings.update_history = [
  {
    fromVersion: "0.21.20",
    toVersion: "0.21.21",
    appliedAt: "2026-05-22T14:30:00Z",
    runId: 26212345678,
    triggeredBy: "admin-user-uuid",
    status: "success" | "failed",
  },
  // ...
]
```

Persist via the existing `instanceSettings.update()` flow. Cap the
array at 20 entries. Pure JSONB → no migration.

### Config (new env vars)

| Var | Required when | Purpose |
|---|---|---|
| `CPUB_UPDATE_GITHUB_REPO` | self-update feature enabled | `owner/repo` of the operator's deploy repo. E.g. `devEcoConsultingLLC/deveco-io` |
| `CPUB_UPDATE_GITHUB_TOKEN` | self-update feature enabled | GitHub PAT with `repo` + `workflow` scopes |
| `CPUB_UPDATE_PACKAGE_JSON_PATH` | optional | Path to package.json in the repo (default `package.json`). Useful if the operator uses a monorepo. |
| `CPUB_UPDATE_BRANCH` | optional | Target branch (default `main`) |

If `CPUB_UPDATE_GITHUB_REPO` is unset → admin panel shows "Self-update
not configured" with a setup-guide link. No feature gates needed
beyond presence-check (the feature is admin-only by access control,
not a separate flag).

### Feature flag

New nested `features.instanceUpdates`:

```ts
features: {
  instanceUpdates: {
    enabled: false,  // default off — operator opts in
    requireApproval: false,  // Phase 2 — open PR instead of direct push
    autoCheckIntervalHours: 24,  // poll npm every N hours; 0 to disable
  },
}
```

The flag lives alongside other nested flags like `identity`. Gate
the admin endpoints + UI on `instanceUpdates.enabled`.

### Backend (server package)

New module `packages/server/src/admin/updates.ts`:

```ts
// Public surface
export interface UpdateCheckResult {
  current: { layer: string; server: string };
  latest: { layer: string; server: string };
  available: boolean;
  crossesServerMinor: boolean;  // for the lockstep warning
  schemaMigrationsAdded: number;  // 0 if same; reads from layer's bundled migrations
  changelogUrl: string | null;  // resolved if maintainer publishes per-version notes
}

export async function checkForUpdates(): Promise<UpdateCheckResult>;
export async function applyUpdate(
  toVersion: string,
  triggeredBy: string,
  config: UpdateConfig,
): Promise<{ runId: number; runUrl: string }>;
export async function getUpdateStatus(runId: number): Promise<UpdateStatus>;
```

Implementation notes:
- `checkForUpdates` → `fetch https://registry.npmjs.org/@commonpub/layer/latest`
  + same for `@commonpub/server`. Both go through `safeFetchResponse`
  (the host is fixed and trusted, but consistency).
- `crossesServerMinor` compares major.minor of current vs latest
  server; the lockstep rule fires if they differ.
- `schemaMigrationsAdded` compares migration count in the operator's
  pinned `@commonpub/schema` (read from
  `node_modules/@commonpub/schema/migrations/*.sql`) to the latest
  schema's count — fetched via npm tarball metadata (or simpler:
  embed a `migrationCount` field in `@commonpub/schema/package.json`
  going forward).
- `applyUpdate` calls GitHub REST `workflow_dispatch` with the right
  inputs. Validates that `toVersion` is in npm's published versions.
- `getUpdateStatus` polls GitHub `GET /actions/runs/:id` + the deploy
  run started by the bump-and-push.

### Admin panel UI

New page `layers/base/pages/admin/updates.vue`:

```
┌────────────────────────────────────────────────┐
│ Update CommonPub                               │
├────────────────────────────────────────────────┤
│ Current version: layer 0.21.20, server 2.55.0  │
│ Latest available: layer 0.21.21, server 2.55.1 │
│                                                │
│ ✓ Patch update only                            │
│ ✓ No schema migrations                         │
│ → Changelog: [link]                            │
│                                                │
│              [Update Now]   [Skip this update] │
└────────────────────────────────────────────────┘
```

When an update crosses a minor (e.g. server 2.55 → 2.56):

```
⚠ This update includes a server minor bump (2.55 → 2.56).
   Lockstep pins will be adjusted automatically. Schema migrations:
   2 new (0005, 0006). Review changelog before applying.
```

Status views during update:

```
Updating to layer 0.21.21...
  ✓ Workflow dispatched (run #26212345678)
  ✓ Bumped package.json + pnpm-lock.yaml
  ✓ Pushed to main
  ⏳ Building Docker image (1m 23s)
  □ Applying schema migrations
  □ Restarting container
  □ Health check
```

History view shows last 5 updates with `from → to`, timestamp,
status, and link to the GitHub run.

### New API routes (in the layer)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/updates/check` | GET | admin | Calls `checkForUpdates()`. Cached 10 min. |
| `/api/admin/updates/apply` | POST | admin | Triggers `applyUpdate(toVersion)`. |
| `/api/admin/updates/status/:runId` | GET | admin | Calls `getUpdateStatus(runId)`. |
| `/api/admin/updates/history` | GET | admin | Returns last 20 entries from `instance_settings.update_history`. |

### New workflow file in the scaffolder

`tools/create-commonpub/src/template.rs` `render_update_workflow()`
emits a new `.github/workflows/update.yml`:

```yaml
name: Update CommonPub

on:
  workflow_dispatch:
    inputs:
      layer_version:
        description: "Version of @commonpub/layer to install (e.g. 0.21.21)"
        required: true
      server_version:
        description: "Optional: @commonpub/server version (lockstep). Defaults to latest matching layer's resolved ranges."
        required: false

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.UPDATE_PAT }}  # PAT with repo write
      - uses: pnpm/action-setup@v4
        with:
          version: 10.10.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      # Bump pins (a small node script handles the package.json edit)
      - name: Bump @commonpub/layer + @commonpub/server pins
        run: |
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.dependencies['@commonpub/layer'] = '^${{ inputs.layer_version }}';
            if ('${{ inputs.server_version }}') {
              pkg.dependencies['@commonpub/server'] = '^${{ inputs.server_version }}';
            }
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
          "
      - name: Refresh lockfile
        run: pnpm install --lockfile-only
      - name: Commit and push
        run: |
          git config user.name "commonpub-update-bot"
          git config user.email "noreply@commonpub.io"
          git add package.json pnpm-lock.yaml
          git commit -m "chore(deps): bump @commonpub/layer ^${{ inputs.layer_version }} (instance self-update)"
          git push origin main
```

Existing thin-apps need this added manually OR by re-running the
scaffolder against their existing config. Phase 1 ships a migration
guide: "Copy `.github/workflows/update.yml` from
`commonpub/commonpub/tools/create-commonpub/dist/templates/` and add
a `UPDATE_PAT` secret with `repo` + `workflow` scopes."

### Test surface

- `packages/server/src/admin/__tests__/updates.test.ts`:
  - `checkForUpdates` mocked npm registry response, asserts
    `available`/`crossesServerMinor` logic
  - `applyUpdate` mocked GitHub API, asserts correct payload sent
  - Version parsing edge cases (pre-release tags, missing dist-tag)
- `layers/base/server/api/admin/updates/__tests__/`:
  - Each route: admin required, returns expected shape
- `apps/reference/e2e/updates.spec.ts`:
  - Admin can open /admin/updates page
  - "Update Now" button disabled when up-to-date

### Migration / rollout

1. Ship feature gated `instanceUpdates.enabled: false` by default.
2. Document the setup in `docs/reference/guides/admin-updates.md`
   (operator-side: env vars, PAT scopes, workflow file).
3. Test on deveco.io first (set up `UPDATE_PAT`, copy workflow file).
4. Flip flag on deveco.io, do a real update of 0.21.20 → next patch.
5. If green: promote to commonpub.io's docs as the recommended path.
6. Scaffolder bumps to emit the workflow file + a README section.

## Phase 2+ (future, not in scope)

- **Per-package version picker**: let admin update only schema, only
  ui, etc. Requires deeper introspection (which packages are pinned
  vs transitive).
- **Approval workflow**: open PR instead of direct push when
  `requireApproval: true`.
- **Multi-instance management**: a maintainer running 3 forks gets
  a "updates available across all your instances" dashboard. Needs
  cross-instance auth.
- **Automatic background updates**: cron-driven, with a config
  `instanceUpdates.auto = "patch" | "minor" | "off"`.
- **Rollback button**: one-click `git revert + redeploy`. Requires
  thinking about DB rollback (schema migrations may not be reversible).
- **DigitalOcean App Platform path**: dispatch a DO deploy via the
  DO API for operators not on the docker-compose pattern.

## Phase 1 cost estimate

| Surface | Effort |
|---|---|
| `packages/server/src/admin/updates.ts` + tests | ~4 hours |
| 4 new API routes (check / apply / status / history) | ~2 hours |
| Admin UI page + composable | ~6 hours |
| Scaffolder workflow file + tests + docs | ~2 hours |
| Wiring to existing instance_settings table | ~1 hour |
| Live test on deveco.io | ~2 hours |
| Docs (admin-updates.md guide) | ~2 hours |
| **Total** | **~19 hours / 2-3 sessions** |

## Risks

- **GitHub API rate limits**: 5,000/hour authenticated. Admin panel
  polls every 30s during an active update → ~120 calls / hour.
  Well under the limit even for 10 concurrent updates.
- **Stale npm dist-tag**: an in-flight publish that doesn't make it
  to `latest` dist-tag means "latest available" might show an
  unpublished version. Use `pnpm view @commonpub/layer versions
  --json` semantics: pick latest stable, skip pre-releases.
- **PAT theft**: `CPUB_UPDATE_GITHUB_TOKEN` is a high-value secret.
  Should be set as a Docker secret / DO App Platform encrypted env,
  not a regular env. Document this. Consider GitHub Apps as a Phase
  2 alternative (instance-scoped permissions instead of user PATs).
- **Half-baked deploys**: if the bump+push succeeds but the deploy
  workflow fails (image build error, SSH reset, ECONNRESET), the
  repo is now ahead of what's deployed. Admin UI should show this
  clearly: "Repo bumped to 0.21.21, but deploy failed. Click Retry
  Deploy or Revert."
- **Schema migration safety**: a new layer version that introduces
  a not-backwards-compatible migration could break federation /
  existing user sessions. Phase 1 lacks dry-run; the operator just
  trusts the maintainer. Phase 2 should add a dry-run / preview.

## Decision points needed before implementation

1. **Approval flow default**: ship Phase 1 with direct-push-to-main,
   or with open-PR-then-merge? My read: direct-push, because the
   primary UX win is "click button, it just works." Approval flow
   can come in Phase 2.
2. **GitHub Apps vs PATs**: ship Phase 1 with PATs (simpler) or
   invest in a GitHub App (more secure, but complex setup)?
   PATs first; GitHub App in Phase 2.
3. **Schema migration confirmation**: should the admin be required
   to type "I understand this includes schema changes" before
   confirming? Or just show a warning? My read: a checkbox is fine;
   over-confirming train users to click through.
4. **Which packages to track**: layer + server only in Phase 1
   (transitive deps follow) — confirm or expand?

I lean toward implementing the minimal viable Phase 1 (direct push,
PAT, checkbox warning, layer+server only) so we get the UX win
shipped fast. Phase 2 can layer on the more conservative behaviors
as operator demand surfaces.
