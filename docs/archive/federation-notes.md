# Federation Research Notes & Decisions Log

> Last updated: 2026-03-20
> Companion to `docs/federation-plan.md`

---

## Research Sources (Verified)

### Specifications
- **W3C ActivityPub** — Server-to-server protocol. Key: objects delivered to inboxes, collections for followers/following/outbox, public addressing via `https://www.w3.org/ns/activitystreams#Public`
- **WebFinger (RFC 7033)** — `/.well-known/webfinger?resource=acct:user@domain` → JRD with actor URI
- **NodeInfo 2.1** — Instance metadata: software name/version, protocols, user counts, open registrations
- **HTTP Signatures (draft-cavage-12)** — De facto standard. Sign `(request-target)`, `host`, `date`, `digest`. RSA-SHA256.
- **RFC 9421** — New HTTP Message Signatures standard. Some implementations support it. Fedify uses double-knocking (try cavage first, then 9421).
- **FEP-1b12** — Group federation. Status: FINAL. Hub = Group actor. Content forwarded via Announce pattern.
- **FEP-400e** — Publicly-appendable collections (posting to groups via `target` field)
- **FEP-8b32** — Object Integrity Proofs via Ed25519/JCS. Ties identity to signing key, not hostname.
- **FEP-044f** — Quote posts
- **FEP-5624** — Per-object reply control

### Implementations Studied

| Software | What We Learned | Relevance |
|----------|----------------|-----------|
| **Lemmy** | Group actor pattern with Announce wrapping. Communities are Groups. All content re-distributed by Group actor. Moderation via Block/Remove wrapped in Announce. | **Direct model for hub federation.** |
| **Mastodon** | Article type IS supported (renders in web UI). `toot:` namespace for extensions. Visibility from addressing, not explicit field. HTML sanitized strictly. | **Primary interop target.** |
| **PeerTube** | CacheFile for content mirroring with admin-configured strategies (most-viewed, trending). Origin controls who can mirror. | **Model for content mirroring strategy.** |
| **BookWyrm** | Custom Review/Comment/Quotation types with Article/Note fallback. Non-BookWyrm servers see Article. | **Validates our graceful degradation approach.** |
| **Pixelfed** | Image attachments, blurhash, focal points. Capabilities ACL. | **Media handling patterns.** |
| **Funkwhale** | Custom types (Artist/Album/Track/Library). Access-controlled libraries. | **Validates custom AP types for structured content.** |
| **Misskey** | Reaction extensions, Quote type, poll extensions. | **Extension patterns.** |
| **GoToSocial** | Mastodon-compatible, blocklist/allowlist modes. Groups planned but not yet. | **Selective federation model.** |
| **Manyfold** | `f3di` namespace for 3D model content. Dual-activity pattern: Send both custom type and Note. | **Alternative graceful degradation approach.** |
| **Hollo** | Built with Fedify. Uses Drizzle + Postgres. Production reference for Fedify patterns. | **Closest tech stack to ours.** |

### Fedify 2.0

- **Version**: 2.0.0 (current major release as of early 2026)
- **Key packages**: `@fedify/fedify` (core), `@fedify/h3` (Nitro integration), `@fedify/postgres` (PG store + queue), `@fedify/vocab` (AP vocabulary)
- **Integration**: `@fedify/h3` provides `integrateFederation()` middleware for Nitro/H3
- **Queue**: `PostgresMessageQueue` — same PG instance, no Redis needed for delivery queue
- **Key management**: Dispatchers for key pairs. Supports both RSA and Ed25519.
- **Delivery**: `ctx.sendActivity()` handles signing, fan-out, retry, shared inbox dedup
- **Funded by**: Sovereign Tech Fund (EUR 192k)
- **Limitation**: No Cloudflare Workers support
- **Reference app**: Hollo (microblogging built with Fedify + Drizzle + PG)

---

## Key Decisions Made

### D1: Use Fedify 2.0 for delivery instead of hand-rolling

**Decision**: Replace hand-rolled HTTP signing + delivery with Fedify 2.0's `ctx.sendActivity()`.

**Why**: Fedify handles double-knocking (draft-cavage → RFC 9421), fan-out, shared inbox optimization, retry with backoff, and delivery queuing. Hand-rolling this would take weeks and miss edge cases that Fedify has already solved.

**What we keep**: Our hand-rolled WebFinger/NodeInfo builders become helpers called by Fedify dispatchers. Our content mapper stays. Our DB tables stay. Fedify wraps the delivery layer.

### D2: Separate `federated_content` table instead of storing in `contentItems`

**Decision**: Remote content goes in a separate `federated_content` table, not in the main `contentItems` table.

**Why**:
- `contentItems` has an `authorId` FK to `users` — remote content has no local author
- Different access patterns: local content is edited, versioned, has drafts; remote content is read-only cache
- Avoids polluting local queries with remote data
- Simpler soft-delete semantics (remote deletion is advisory)
- Can drop all federated content without affecting local data

**Trade-off**: Feed queries need UNION across both tables. Worth it for data integrity.

### D3: FEP-1b12 Announce pattern for hub federation (not direct delivery)

**Decision**: Follow Lemmy's pattern — hub Group actor wraps all content in Announce and delivers to followers.

**Why**:
- Battle-tested by Lemmy with thousands of communities
- Ensures all followers see all content (no missed deliveries)
- Hub is the authority — controls what gets Announced
- Moderation is enforceable: if hub doesn't Announce it, followers don't see it
- Compatible with Mastodon/Misskey (they understand Announce from Groups)

**Alternative considered**: Direct delivery from poster to all hub members. Rejected because it bypasses hub moderation and creates N×M delivery complexity.

### D4: CommonPub namespace with graceful degradation

**Decision**: Use JSON-LD context extension `cpub:` for CommonPub-specific properties. Always include standard AS2 type.

**Why**:
- Non-CommonPub servers ignore `cpub:` properties and render standard Article/Note
- CommonPub-to-CommonPub gets full fidelity (BOM, specs, learning data)
- Following BookWyrm's proven approach (custom types + AS2 fallback)
- No need for dual-activity pattern (Manyfold approach) — simpler

**Risk**: JSON-LD processors that are strict about unknown properties. In practice, most AP implementations treat JSON-LD as plain JSON and ignore unknown keys.

### D5: Per-hub keypairs for Group actors

**Decision**: Each hub gets its own RSA keypair, separate from user keypairs.

**Why**:
- Hubs sign their own Announce activities
- Hub identity is independent of any specific user
- If hub owner changes, keypair stays
- Consistent with how Lemmy handles community keys

### D6: Instance actor for mirroring

**Decision**: Use an Application-type instance actor for full instance mirroring.

**Why**:
- Following the instance actor subscribes to all public content
- Clean separation: following a user = their content. Following instance = everything public.
- Instance actor handles mirroring-specific activities (sync requests, media caching)
- Used by PeerTube for similar purpose

### D7: PostgresMessageQueue over Redis for delivery queue

**Decision**: Use Fedify's `@fedify/postgres` PostgresMessageQueue instead of Redis-based BullMQ.

**Why**:
- One less infrastructure dependency (Postgres already required)
- Fedify has first-class support for it
- Sufficient for CommonPub scale (not doing Twitter-scale fan-out)
- Redis still used for rate limiting and caching, but not required for federation queue

**When to revisit**: If delivery queue processing becomes a bottleneck at scale (>10k followers per hub).

---

## Open Questions

### Q1: Should product federation use Group or Service actor type?

Product hubs currently planned as Group. But products are more like catalog entries than communities. Options:
- **Group** (current plan): Consistent with community hubs. People can "follow" a product hub.
- **Service**: More semantically correct for a product page. But less understood by fediverse.
- **Document collection**: Product is a Document, hub is a Collection of Documents.

**Leaning**: Keep as Group for consistency. Product hubs have followers and gallery posts, which is Group behavior.

### Q2: How to handle learning path progress across instances?

If a learning path contains lessons from 3 instances, progress tracking is complex:
- Option A: Progress is local only. Each instance tracks progress on its own lessons.
- Option B: Progress synced via ActivityPub (custom activity: `cpub:CompleteLesson`).
- Option C: Progress stored on the instance that hosts the learning path, lessons fetched remotely.

**Leaning**: Option A for v1 federation. Learning paths that span instances are an advanced feature.

### Q3: Should federated hub moderation be opt-in or opt-out?

When a remote user posts to a hub:
- Option A: Content is auto-Announced (opt-out moderation — moderate after the fact)
- Option B: Content is queued for moderator approval (opt-in moderation)
- Option C: Configurable per hub (default: auto-Announce for members, queue for non-members)

**Leaning**: Option C. Matches hub join policies — open hubs auto-Announce, approval hubs queue.

### Q4: What happens when a mirrored instance goes down?

- Cached content remains available on the mirror
- New content stops arriving
- Mirror shows "last synced X hours ago" warning
- Admin can choose: keep cached content or purge

### Q5: Should we support `Undo(Announce)` for hub content removal?

When a hub moderator removes a post, should we send `Undo(Announce)` to all followers?
- Mastodon handles `Undo(Announce)` by removing the boost
- Lemmy sends `Delete` wrapped in `Announce`

**Leaning**: Send both `Undo(Announce)` (for Mastodon compat) and `Announce(Delete)` (for Lemmy compat).

### Q6: Media proxying — should federated media be proxied through local instance?

- Privacy benefit: users don't make direct requests to remote servers
- Performance: local cache is faster
- Cost: storage and bandwidth
- Mastodon proxies all remote media by default

**Leaning**: Proxy by default with cache eviction. Configurable per-mirror.

---

## Archive Findings (Still Relevant)

### From archived session 008 (federation phase)
- 98 tests added across schema, protocol, and worker packages
- 9 activity types implemented with full type system
- OAuth2 SSO flow implemented (provider side)
- Federation dashboard UI created
- All still in codebase, just feature-flagged off

### From archived session 002 (auth-protocol)
- 42 protocol tests covering WebFinger, NodeInfo, HTTP Signatures
- Actor resolver with SSRF protection
- All still working and passing

### From archive/docs/restructure/extracted-server/federation.ts
- Early federation server module — evolved into current `packages/server/src/federation/federation.ts`
- Same function signatures, more refined implementation in current code

### From archive/docs/restructure/extracted-routes/
- 24 extracted route handlers including all federation endpoints
- Evolved into current reference app routes
- All patterns preserved in current implementation

**Conclusion**: Nothing valuable was lost in the archive. All federation work from the SvelteKit era has been preserved and refined in the current Nuxt 3 codebase.

---

## Comparable Projects & Differentiation

| Project | Federation Content | CommonPub Advantage |
|---------|-------------------|-------------------|
| Mastodon | Short text posts | Rich structured content (projects, BOMs, products) |
| Lemmy | Link posts + comments | Same Group pattern, but for maker content |
| PeerTube | Video channels | Similar mirroring model, but for all content types |
| BookWyrm | Book reviews | Same namespace extension approach, but broader scope |
| Funkwhale | Music/audio | Similar structured content, but different domain |
| Writefreely | Long articles | Articles + projects + products + learning + docs |
| WordPress (AP plugin) | Blog posts | Full platform, not just a blog |
| Manyfold | 3D models | Similar "structured thing" federation, different domain |

**No one federates**:
- Bills of materials (product-project linking across instances)
- Learning paths with enrollment
- Documentation sites with versioning
- Product catalogs with specs
- Communities that span all of the above

This is CommonPub's unique position in the fediverse.

---

## Implementation Sequencing Notes

### What can be built in parallel

- Phase 1 (delivery) and Phase 5 (namespace) are independent
- Phase 4 (OAuth2 consumer) is independent of everything
- Phase 9 (selective federation) can be partially built early (blocklist/allowlist)

### What must be sequential

- Phase 1 before Phase 2 (can't receive if you can't send Accept)
- Phase 2 before Phase 3 (can't interact with content you haven't stored)
- Phases 1–5 before Phase 6 (hub federation needs delivery + persistence + namespace)
- Phase 6 before Phase 8 (BOM federation is a subset of hub federation)

### Minimum viable federation

Phase 1 + Phase 2 = users can follow remote users and see their content. This is the MVP.

### "Full federation as envisioned"

Phases 1–8 = complete content-type-aware federation with hubs, BOMs, and mirroring. This is the full vision.

Phases 9–10 = operational maturity (selective controls, relays, discovery).
