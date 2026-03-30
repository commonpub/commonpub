# Session 092 — Deployment Checklist

## Pre-Deployment Verification

All must pass before proceeding:

- [x] `pnpm --filter @commonpub/schema typecheck` — clean
- [x] `pnpm --filter @commonpub/server typecheck` — clean
- [x] `pnpm --filter @commonpub/server build` — clean
- [x] Full test suite: 507 passed, 0 failed (27 new hub mirroring tests)
- [x] deveco-io `nuxi build` — clean
- [x] Hub module split verified by existing 11 hub integration tests
- [x] Hub federation verified by existing 12 hub-federation tests
- [x] Hub mirroring verified by 27 new integration tests

## Step 1: Version Bumps (commonpub monorepo)

```bash
# In /Users/obsidian/Projects/ossuary-projects/commonpub/

# Schema: 0.8.5 → 0.8.6
# Changes: federatedHubs + federatedHubPosts tables, indexes, types, relations
# Edit packages/schema/package.json

# Server: 2.3.4 → 2.4.0 (minor bump — new feature, not just patch)
# Changes: hub.ts split, hubMirroring module, listHubs includeFederated, inbox wiring
# Edit packages/server/package.json
```

## Step 2: Publish to npm

```bash
pnpm publish:check   # Runs build + typecheck + test
pnpm publish:all     # Publishes all packages
```

## Step 3: Update deveco-io Dependencies

```bash
# In /Users/obsidian/Projects/ossuary-projects/deveco-io/
pnpm update @commonpub/schema @commonpub/server
# Verify lock file updated
pnpm install
```

## Step 4: Deploy commonpub.io (First)

Deploy the commonpub reference app first — it hosts the hubs that deveco will mirror.

```bash
# Push commonpub monorepo to main
# Manually trigger deploy.yml workflow
# OR: SSH to droplet and pull + rebuild
```

The deploy workflow runs `drizzle-kit push --force` which will:
- Create `federated_hubs` table
- Create `federated_hub_posts` table
- Add new indexes

## Step 5: Deploy deveco.io

Push deveco-io to main → GitHub Actions auto-deploys.

Deployment runs `drizzle-kit push --force` which creates the same tables.

## Step 6: End-to-End Verification

### Test A: Hub appears on both instances
1. Verify existing hubs on commonpub.io still work (regression check)
2. Verify existing hubs on deveco.io still work
3. Verify hubs listing page loads on both instances

### Test B: Hub mirroring (deveco mirrors commonpub)
1. On deveco.io, navigate to admin federation panel
2. POST to `/api/admin/federation/hub-mirrors` with:
   ```json
   { "actorUri": "https://commonpub.io/hubs/{slug}" }
   ```
3. Verify federated hub appears in admin hub-mirrors list with status "pending"
4. Check delivery worker logs — Follow activity should be delivered to commonpub.io
5. On commonpub.io, verify the Follow was received (check hub followers)
6. If hub is public+open, Accept is auto-sent
7. On deveco.io, verify federated hub status transitions to "accepted"
8. On deveco.io hubs page, verify the mirrored hub appears with globe badge

### Test C: Post mirroring
1. On commonpub.io, create a post in the mirrored hub
2. Verify the Announce activity is delivered to deveco.io (check delivery worker)
3. On deveco.io, navigate to the federated hub detail page
4. Verify the post appears with correct author info

### Test D: Interactions
1. Verify local hub join/post/like still works on both instances
2. Verify comment federation notice appears on mirror pages
3. Verify bookmark correctly skips for federated content

## Rollback Plan

If something breaks:

### Schema rollback (if drizzle-kit push fails)
The new tables (`federated_hubs`, `federated_hub_posts`) are additive-only. No existing tables are modified. A failed push is harmless — the tables just won't exist and the features won't activate.

### Server rollback
Revert package versions in deveco-io/package.json and redeploy. The hub.ts split doesn't change any behavior — all exports are identical.

### Feature flag protection
Hub mirroring only activates when BOTH `seamlessFederation` AND `federateHubs` feature flags are enabled. Disabling either flag immediately disables the feature without code changes.

## Post-Deployment

- [ ] Verify hubs listing performance hasn't degraded
- [ ] Monitor error logs for federation delivery failures
- [ ] Test mirror from deveco.io → commonpub.io hub
- [ ] Create session 093 doc with deployment results
