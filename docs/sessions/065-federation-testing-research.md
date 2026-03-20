# Session 065 — Federation Testing Research

**Date:** 2026-03-20
**Goal:** Research practical approaches to testing ActivityPub federation implementations

---

## 1. How Mastodon Tests Federation

Mastodon uses RSpec with extensive HTTP mocking via `stub_request` (WebMock). Key patterns:

**Fixture-based JSON payloads** — Tests construct ActivityPub actor/activity JSON inline:
```ruby
{
  id: 'https://foo.test',
  type: 'Actor',
  inbox: 'https://foo.test/inbox',
  attachment: [
    { type: 'PropertyValue', name: 'Pronouns', value: 'They/them' }
  ]
}.with_indifferent_access
```

**WebFinger stubbing** — Mock `.well-known/webfinger` responses:
```ruby
stub_request(:get, "https://foo.test/.well-known/webfinger?resource=acct:user@foo.test")
  .to_return(body: webfinger.to_json, headers: { 'Content-Type': 'application/jrd+json' })
```

**HTTP request interception** — All outbound fetches are stubbed to return fixture data:
```ruby
stub_request(:get, 'https://foo.test/image.png')
  .to_return(request_fixture('avatar.txt'))
```

**Test coverage areas** (`spec/services/activitypub/`):
- `process_account_service_spec.rb` — Account discovery, rate limiting
- `fetch_remote_status_service_spec.rb` — Remote status fetching
- `fetch_remote_key_service_spec.rb` — Public key retrieval
- `synchronize_followers_service_spec.rb` — Follower sync
- `verify_quote_service_spec.rb` — Quote post verification

Mastodon does NOT have an automated interop test suite against other implementations. They test federation behavior in isolation using mocked HTTP responses.

**HTTP Signatures**: Mastodon is migrating from draft-cavage to RFC 9421. Added RFC 9421 receiving support under an experimental flag in Mastodon 4.4 (June 2025).

Source: [mastodon/mastodon on GitHub](https://github.com/mastodon/mastodon), [Mastodon Security Docs](https://docs.joinmastodon.org/spec/security/)

---

## 2. How Lemmy Tests Federation

Lemmy's approach is fundamentally different — they extracted federation into a reusable Rust library: **activitypub-federation-rust**.

**Recorded payload fixtures** — Lemmy has a test suite that (de)serializes JSON from other AP projects to ensure compatibility. Example payloads from their docs:

```json
// Person
{
  "id": "https://enterprise.lemmy.ml/u/picard",
  "type": "Person",
  "preferredUsername": "picard",
  "name": "Jean-Luc Picard",
  "inbox": "https://enterprise.lemmy.ml/u/picard/inbox",
  "published": "2020-01-17T01:38:22.348392Z"
}

// Page (Post)
{
  "id": "https://enterprise.lemmy.ml/post/55143",
  "type": "Page",
  "attributedTo": "https://enterprise.lemmy.ml/u/picard",
  "name": "Post title",
  "content": "<p>This is a post in the /c/tenforward community</p>",
  "published": "2021-02-26T12:35:34.292626Z"
}

// ChatMessage (Private Message)
{
  "id": "https://enterprise.lemmy.ml/private_message/1621",
  "type": "ChatMessage",
  "attributedTo": "https://enterprise.lemmy.ml/u/picard",
  "to": ["https://queer.hacktivis.me/users/lanodan"],
  "content": "<p>Hello hello, testing</p>"
}
```

**Local federation example** — Their `local_federation` example creates two instances on localhost that federate with each other. Lemmy uses this same setup for CI tests: multiple instances started as different threads, controlled over the API.

Source: [activitypub-federation-rust](https://github.com/LemmyNet/activitypub-federation-rust), [Lemmy Federation Docs](https://join-lemmy.org/docs/contributors/05-federation.html)

---

## 3. Fedify Testing Utilities

Fedify has a dedicated `@fedify/testing` package (available since Fedify 1.9.1, released December 2025). This is what we should use.

### Installation
```bash
pnpm add -D @fedify/testing
```

### `createFederation()` — Mock Federation
```typescript
import { createFederation } from "@fedify/testing";

const federation = createFederation<ContextData>({
  contextData: { userId: "test-user" }
});

// Register dispatchers (same API as real Federation)
federation.setActorDispatcher("/users/{identifier}", actorHandler);
federation.setInboxListeners("/users/{identifier}/inbox")
  .on(Create, async (ctx, activity) => {
    // Your inbox logic under test
  });

// Simulate receiving an activity
await federation.receiveActivity(activity);

// Track all sent activities
for (const sent of federation.sentActivities) {
  console.log(sent.activity.id);   // Activity URI
  console.log(sent.queued);        // Was it queued?
  console.log(sent.queue);         // Which queue?
  console.log(sent.sentOrder);     // Send order
}

// Reset between tests
federation.reset();
```

### `createContext()` — Mock Context
```typescript
const context = federation.createContext(
  new URL("https://example.com"),
  { userId: "test-user" }
);

// Generate URIs using configured paths
context.getActorUri("alice");   // https://example.com/users/alice
context.getInboxUri("alice");   // https://example.com/users/alice/inbox
context.getOutboxUri("alice");

// Send activity and track it
await context.sendActivity(sender, recipient, activity);
const sent = context.getSentActivities();

context.reset();
```

### Queue Simulation
```typescript
await federation.startQueue({ contextData: { userId: "test" } });
// Activities are now marked with queued: true
```

### Fedify CLI — Ephemeral Inbox
```bash
npx fedify inbox
```
Spins up a temporary inbox server that receives and displays incoming ActivityPub messages. Useful for manual testing.

Source: [Fedify Testing Docs](https://fedify.dev/manual/test), [@fedify/testing PR #283](https://github.com/fedify-dev/fedify/pull/283)

---

## 4. ActivityPub Conformance Test Suites

### go-fed/testsuite (50 stars)
- Unofficial AP test suite that approximates the official test.activitypub.rocks
- Partially automates C2S, S2S, and common tests
- Creates temporary TestRunners with in-memory databases (15-min lifespan)
- The test suite itself is a fully-fledged federating S2S ActivityPub application
- Requires a real domain + TLS certificates (localhost won't work)
- Status: Alpha, incomplete C2S coverage
- Source: [go-fed/testsuite](https://github.com/go-fed/testsuite)

### FediTest (36 stars)
- Testing framework for distributed, heterogeneous fediverse systems
- Tests WebFinger, ActivityPub, and HTTP Signatures
- Version 0.5 (early but usable)
- Presented at FOSDEM 2025
- Source: [feditest.org](https://feditest.org/), [GitHub](https://github.com/fediverse-devnet/feditest)

### socialweb.coop/activitypub-testing
- Funded by Germany's Sovereign Tech Fund (EUR 152,000)
- Created machine-readable dataset of every MUST behavior from the AP spec
- Extracted conformance requirements into `activitypub-behaviors` dataset
- Goal: deterministic conformance testing
- Source: [Codeberg](https://codeberg.org/socialweb.coop/activitypub-testing)

### W3C SWICG Test Suite Task Force
- Coordinates official AP test suite work
- Source: [swicg/ap-test-suite-taskforce](https://github.com/swicg/ap-test-suite-taskforce)

---

## 5. ActivityPub Fuzzer (46 stars)

The `activitypub-fuzzer` from Berkman Center is a practical interop testing tool:
- Uses data from the **Fediverse Schema Observatory** to emulate known fediverse software
- Can send messages formatted exactly as specific software versions would produce them
- "Fire hose" mode simulates a statistically-weighted mock public feed (Mastodon-heavy, matching real distribution)
- Can test individual message schemas in isolation
- Requires: Node.js v20+, HTTPS tunnel (ngrok or Fedify), Schema Observatory DB snapshot
- Source: [berkmancenter/activitypub-fuzzer](https://github.com/berkmancenter/activitypub-fuzzer)

---

## 6. Testing HTTP Signatures

### Libraries
| Package | Standard | Notes |
|---------|----------|-------|
| `activitypub-http-signatures` | draft-cavage-08 | Parse, create, verify signatures |
| `@misskey-dev/node-http-message-signatures` | RFC 9421 + draft | Used by Misskey, supports both old and new |
| `http-message-signatures` | RFC 9421 | Built-in Node.js crypto signers/verifiers |

### Test Pattern for Signing/Verification
```typescript
import { generateKeyPair } from "node:crypto";
import { signRequest, verifyRequest } from "activitypub-http-signatures";

// Generate test keypair
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Sign a request
const signed = signRequest(request, {
  keyId: "https://example.com/users/alice#main-key",
  privateKey,
});

// Verify by parsing the signature header, fetching the key, and verifying
const parsed = parseSignatureHeader(request.headers.signature);
const valid = verifySignature(parsed, publicKey);
```

### Practical Test Strategy
1. Generate ephemeral RSA keypairs in `beforeAll`
2. Sign outgoing requests in unit tests and verify the signature header is well-formed
3. For verification tests, construct requests with known-good signatures and verify they pass
4. Test rejection of tampered requests (modified body, wrong key, expired digest)
5. Test both draft-cavage AND RFC 9421 if targeting Mastodon 4.4+

---

## 7. Mocking ActivityPub Inboxes

### Fedify's MockFederation (recommended for our stack)
See section 3 above — `federation.receiveActivity()` simulates inbox delivery.

### Fedify CLI Ephemeral Inbox
```bash
npx fedify inbox
```
Temporary server that accepts and displays AP messages.

### Manual Mock Pattern
```typescript
// Simple inbox mock for integration tests
import { createServer } from "node:http";

function createMockInbox() {
  const received: object[] = [];
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/inbox") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received.push(JSON.parse(body));
        res.writeHead(202);
        res.end();
      });
    }
  });
  return { server, received };
}
```

### WebFinger Mock
```typescript
// Minimal WebFinger response for testing
function createWebFingerResponse(username: string, domain: string) {
  return {
    subject: `acct:${username}@${domain}`,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${domain}/users/${username}`,
      },
    ],
  };
}
```

---

## 8. PGlite for Integration Testing with Drizzle ORM

PGlite is a WASM-compiled PostgreSQL that runs in-process. No Docker, no external dependencies, real SQL.

### Installation
```bash
pnpm add -D @electric-sql/pglite
```

### Pattern A: vi.mock approach (recommended)
```typescript
// vitest.setup.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@commonpub/schema";
import { beforeAll, afterEach, afterAll, vi } from "vitest";

vi.mock("@commonpub/server/db", async (importOriginal) => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return {
    ...(await importOriginal()),
    db,
    client,
  };
});

beforeAll(async () => {
  // Use pushSchema instead of migrations for speed
  const { createRequire } = await vi.importActual<typeof import("node:module")>("node:module");
  const require = createRequire(import.meta.url);
  const { pushSchema } = require("drizzle-kit/api-postgres");
  const { apply } = await pushSchema(schema, db as any);
  await apply();
});

afterEach(async () => {
  // Reset between tests
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  // Re-apply schema
  const { apply } = await pushSchema(schema, db as any);
  await apply();
});

afterAll(async () => {
  client.close();
});
```

### Pattern B: Dependency injection approach
```typescript
// test-helpers/db.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@commonpub/schema";

export function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  return { db, client };
}
```

### Key Notes
- Use `drizzle-kit/api-postgres` (not `drizzle-kit/api` — the export was restructured)
- Use `pushSchema` instead of `migrate` — no migration files needed for tests
- Must use `require()` for `drizzle-kit/api-postgres` due to dynamic import issues
- PGlite supports most PostgreSQL features including JSON, arrays, and extensions
- Tests run in milliseconds with no Docker overhead

Source: [Drizzle PGlite Docs](https://orm.drizzle.team/docs/get-started/pglite-new), [drizzle-vitest-pg](https://github.com/rphlmr/drizzle-vitest-pg), [Drizzle discussion #4216](https://github.com/drizzle-team/drizzle-orm/discussions/4216)

---

## 9. Testing WebFinger Responses

### Unit test pattern
```typescript
describe("WebFinger", () => {
  it("returns correct JRD for known user", async () => {
    const response = await app.request(
      "/.well-known/webfinger?resource=acct:alice@example.com"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/jrd+json");

    const body = await response.json();
    expect(body).toEqual({
      subject: "acct:alice@example.com",
      links: [
        {
          rel: "self",
          type: "application/activity+json",
          href: "https://example.com/users/alice",
        },
      ],
    });
  });

  it("returns 404 for unknown user", async () => {
    const response = await app.request(
      "/.well-known/webfinger?resource=acct:nobody@example.com"
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for missing resource parameter", async () => {
    const response = await app.request("/.well-known/webfinger");
    expect(response.status).toBe(400);
  });
});
```

### What to test
- Correct `application/jrd+json` content type
- `subject` matches the queried `acct:` URI
- `links` array contains `self` rel with `application/activity+json` type
- 404 for unknown accounts
- 400 for missing or malformed `resource` param
- CORS headers if applicable
- Rate limiting behavior

---

## 10. Testing Async Delivery Queues

### Strategy: Separate business logic from queue infrastructure

```typescript
// processors/deliverActivity.ts — pure function, no queue dependency
export async function deliverActivity(
  data: DeliveryJob,
  deps: DeliveryDeps
): Promise<DeliveryResult> {
  const { activity, recipientInbox, senderKeyId, privateKey } = data;
  const signed = deps.signer.sign(activity, senderKeyId, privateKey);
  const response = await deps.httpClient.post(recipientInbox, signed);
  if (response.status >= 400) {
    throw new DeliveryError(response.status, recipientInbox);
  }
  return { delivered: true, inbox: recipientInbox };
}
```

```typescript
// Test the processor in isolation
describe("deliverActivity", () => {
  const mockDeps = {
    signer: { sign: vi.fn().mockReturnValue(signedPayload) },
    httpClient: { post: vi.fn().mockResolvedValue({ status: 202 }) },
  };

  it("signs and delivers the activity", async () => {
    const result = await deliverActivity(jobData, mockDeps);
    expect(mockDeps.signer.sign).toHaveBeenCalledWith(
      activity, senderKeyId, privateKey
    );
    expect(result.delivered).toBe(true);
  });

  it("throws on delivery failure", async () => {
    mockDeps.httpClient.post.mockResolvedValue({ status: 500 });
    await expect(deliverActivity(jobData, mockDeps)).rejects.toThrow();
  });
});
```

### Key principles
1. **Extract processors as pure functions** with injected dependencies
2. **Mock at boundaries** — HTTP client, signer, database
3. **Test retry logic separately** — verify attempt count, backoff behavior
4. **Use mock job objects** for testing queue-specific interactions:
   ```typescript
   function createMockJob<T>(data: T, opts?: Partial<Job<T>>): Partial<Job<T>> {
     return {
       id: `job-${Date.now()}`,
       data,
       attemptsMade: 0,
       updateProgress: vi.fn(),
       log: vi.fn(),
       getState: vi.fn().mockResolvedValue("active"),
       ...opts,
     };
   }
   ```
5. **Test idempotency** — same job processed twice should not duplicate effects
6. **Test dead letter handling** — what happens after max retries

---

## 11. Interop Testing Between AP Implementations

### Practical approaches (ranked by effort)

1. **Payload serialization/deserialization tests** (lowest effort)
   - Collect real JSON from Mastodon, Lemmy, Misskey, GoToSocial
   - Test that your deserializer handles each variant
   - Lemmy does this in CI — "a test suite which (de)serializes json from other projects"

2. **ActivityPub Fuzzer** (moderate effort)
   - Uses Fediverse Schema Observatory data
   - Sends messages formatted as specific software versions would
   - Simulates realistic traffic distribution

3. **Two-instance local federation** (moderate effort)
   - Run two instances of your own software on different ports
   - Use Fedify's `createFederation` or Docker Compose
   - Test Follow, Create, Announce, Like, Undo flows end-to-end

4. **Docker-based cross-implementation** (high effort)
   - Use Minifedi or Kubernetes setups (see section 12)
   - Run your software alongside Mastodon/GoToSocial
   - Manual or scripted API-driven tests

5. **FediTest** (emerging)
   - Standardized cross-implementation test framework
   - Still early (v0.5) but actively developed

---

## 12. Docker-Based Federation Test Environments

### Minifedi (35 stars)
- Spins up a complete miniature fediverse on one machine
- Supports: **Mastodon, Akkoma, GoToSocial**
- 5 pre-configured test users per instance (credentials: `a`/`MiniFediA1!` through `e`/`MiniFediE1!`)
- Includes **mitmproxy** integration for inspecting HTTP traffic between instances
- Requires: macOS or Linux, Nix, ~4GB disk + 4GB RAM, ports 80/443
- Setup: `./minifedi start` (20-30 minutes first build)
- Instances at `INSTANCENAME.lvh.me` (e.g., `https://mastodon.lvh.me`)
- Source: [Gaelan/minifedi](https://github.com/Gaelan/minifedi)

### kubernetes-activitypub-testing
- k3s cluster with Helm charts for Mastodon and Pixelfed
- Source: [cetra3/kubernetes-activitypub-testing](https://github.com/cetra3/kubernetes-activitypub-testing)

### Custom Docker Compose (recommended for CI)
```yaml
# docker-compose.test.yml
services:
  instance-a:
    build: .
    environment:
      - DOMAIN=a.test.local
      - DATABASE_URL=postgres://postgres:postgres@db-a:5432/commonpub
    ports: ["3001:3000"]
    depends_on: [db-a]

  instance-b:
    build: .
    environment:
      - DOMAIN=b.test.local
      - DATABASE_URL=postgres://postgres:postgres@db-b:5432/commonpub
    ports: ["3002:3000"]
    depends_on: [db-b]

  db-a:
    image: postgres:16
    environment:
      POSTGRES_DB: commonpub
      POSTGRES_PASSWORD: postgres

  db-b:
    image: postgres:16
    environment:
      POSTGRES_DB: commonpub
      POSTGRES_PASSWORD: postgres
```

---

## Recommended Testing Strategy for CommonPub

### Layer 1: Unit Tests (fast, PGlite + Vitest)
- Schema validation (Zod validators)
- Activity serialization/deserialization against fixture JSON from Mastodon, Lemmy, Misskey
- HTTP Signature signing and verification with ephemeral keypairs
- WebFinger response format
- Business logic processors (extracted from queue)

### Layer 2: Integration Tests (Fedify MockFederation + PGlite)
- Inbox listener behavior — receive activities and verify DB state
- Outbox dispatch — verify correct activities sent to correct recipients
- Actor dispatcher — verify actor JSON-LD served correctly
- Follow/Accept/Reject flows
- Activity delivery retry logic

### Layer 3: Federation Tests (Docker Compose, two instances)
- Two CommonPub instances federating with each other
- Full Follow -> Create -> Announce -> Like -> Undo lifecycle
- Cross-instance content visibility
- Key rotation / signature verification

### Layer 4: Interop Tests (optional, pre-release)
- ActivityPub Fuzzer against CommonPub
- Minifedi with CommonPub + Mastodon/GoToSocial
- Serialization tests against real payloads from other implementations

---

## Open Questions
- Should we vendor fixture JSON from Mastodon/Lemmy/Misskey into `@commonpub/test-utils`?
- Do we need RFC 9421 support from day one, or can we start with draft-cavage only?
- Should PGlite be the default test DB, or keep Docker Postgres as an option for CI?
- When do we start running FediTest against CommonPub?

## Next Steps
- Set up `@commonpub/test-utils` with PGlite helper, mock federation factory, and fixture payloads
- Add `@fedify/testing` to dev dependencies
- Create fixture JSON files from real Mastodon/Lemmy/Misskey payloads
- Write first federation unit tests for the protocol package
