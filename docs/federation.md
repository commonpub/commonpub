# Federation — How CommonPub Connects the Maker Web

> CommonPub uses [ActivityPub](https://www.w3.org/TR/activitypub/) to federate structured maker content between independent instances. This document explains how it works, what it can do, and how it differs from anything else in the fediverse.

---

## Table of Contents

- [The Big Picture](#the-big-picture)
- [What Gets Federated](#what-gets-federated)
- [How ActivityPub Works](#how-activitypub-works)
- [Actor Types](#actor-types)
- [Discovery — Finding People and Hubs](#discovery--finding-people-and-hubs)
- [Following and Feeds](#following-and-feeds)
- [Content Federation](#content-federation)
- [Hub Federation (Groups)](#hub-federation-groups)
- [BOM Federation — The Network Effect](#bom-federation--the-network-effect)
- [Content Mirroring](#content-mirroring)
- [Cross-Instance Interaction](#cross-instance-interaction)
- [Authentication Across Instances](#authentication-across-instances)
- [Selective Federation](#selective-federation)
- [Interoperability with the Fediverse](#interoperability-with-the-fediverse)
- [Relay and Discovery](#relay-and-discovery)
- [Security Model](#security-model)
- [Admin Controls](#admin-controls)

---

## The Big Picture

```
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│         hack.build              │     │      circuits.community         │
│                                 │     │                                 │
│  ┌───────┐  ┌────────────────┐  │     │  ┌───────┐  ┌────────────────┐  │
│  │ Alice │  │ Robotics Hub   │  │     │  │  Bob  │  │ Arduino Hub    │  │
│  │(Person)│  │   (Group)     │  │     │  │(Person)│  │   (Group)     │  │
│  └───┬───┘  └───────┬────────┘  │     │  └───┬───┘  └───────┬────────┘  │
│      │              │           │     │      │              │           │
│  ┌───▼───────────┐  │           │     │  ┌───▼───────────┐  │           │
│  │ Robot Arm     │  │           │     │  │ Arduino Nano  │  │           │
│  │ Project       │──┼───────────┼─────┼──│ Product       │  │           │
│  │ (Article+BOM) │  │           │     │  │ (Document)    │  │           │
│  └───────────────┘  │           │     │  └───────────────┘  │           │
│                     │           │     │                     │           │
└─────────────────────┼───────────┘     └─────────────────────┼───────────┘
                      │   ActivityPub                         │
                      └──────────────────────────────────────┘
                              Federated link:
                    Alice's project uses Bob's product.
                   Both galleries update automatically.
```

Every CommonPub instance is an independent, self-hosted server with its own database, users, and content. Federation connects them:

- **Users** can follow users on other instances
- **Hubs** (communities) can have members from multiple instances
- **Content** flows between instances via ActivityPub activities
- **Products** referenced in projects create cross-instance gallery links
- **Everything degrades gracefully** — Mastodon and other fediverse software see standard articles

---

## What Gets Federated

| Content Type | AP Object Type | What Federates | What Stays Local |
|-------------|---------------|----------------|-----------------|
| Projects | Article + `cpub:bom` | Full article, cover image, tags, BOM with product links | Draft state, view counts, edit history |
| Blog Posts | Article | Full article, cover image, tags | Draft state |
| Explainers | Article + `cpub:sections` | Content as article, section metadata | Interactive runtime state |
| Products | Document + `cpub:specs` | Name, specs, purchase URL, datasheet | Internal inventory |
| Hub Posts | Note + `audience` | Post content, replies | Pin state (hub-local) |
| Comments | Note + `inReplyTo` | Comment text, threading | Edit history |
| Likes | Like activity | Like/unlike events | — |
| Follows | Follow activity | Follow/unfollow lifecycle | — |
| Learning Paths | Collection + `cpub:learningPath` | Path structure, module/lesson list | Enrollment, progress, certificates |
| Doc Sites | Collection + `cpub:docSite` | Site structure, page content | Version management |
| User Profiles | Person actor | Bio, avatar, public key, links | Email, settings, sessions |
| Hubs | Group actor | Name, description, rules, membership | Internal moderation logs |

> `article` is a deprecated content-type alias that normalizes to `blog`
> on write (session-116). Content authored as `article` federates
> identically to a Blog Post. Use `blog`, `project`, or `explainer` for
> new content; never `article`.

---

## How ActivityPub Works

ActivityPub is a W3C standard protocol for decentralized social networking. Here's the core flow:

```
                    ┌──────────────────────┐
                    │   1. Alice publishes  │
                    │   a project on       │
                    │   hack.build         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   2. hack.build      │
                    │   builds a Create    │
                    │   activity wrapping  │
                    │   an Article object  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────▼──────┐ ┌──────▼──────┐ ┌───────▼─────────┐
   │ 3a. Deliver to  │ │ 3b. Deliver │ │ 3c. Deliver to  │
   │ Bob's inbox on  │ │ to Robotics │ │ relay (optional) │
   │ circuits.com    │ │ Hub followers│ │                 │
   └──────────┬──────┘ └──────┬──────┘ └───────┬─────────┘
              │               │                │
   ┌──────────▼──────┐ ┌──────▼──────┐ ┌───────▼─────────┐
   │ 4a. Bob sees    │ │ 4b. All hub │ │ 4c. Subscribed  │
   │ article in his  │ │ members see │ │ instances get   │
   │ federated feed  │ │ it in feed  │ │ the content     │
   └─────────────────┘ └─────────────┘ └─────────────────┘
```

### Key Concepts

- **Actor**: An entity with an inbox and outbox. Users are `Person` actors. Hubs are `Group` actors.
- **Activity**: An action — Create, Update, Delete, Follow, Like, Announce, etc.
- **Object**: The thing an activity acts on — Article, Note, Document, etc.
- **Inbox**: Where an actor receives activities from other servers.
- **Outbox**: A collection of activities an actor has published.
- **HTTP Signatures**: Every server-to-server request is cryptographically signed to prove identity.

### The Activity Lifecycle

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Origin      │      │   Network    │      │  Recipient  │
│  Instance    │      │              │      │  Instance   │
│              │      │              │      │             │
│ 1. Mutation  │      │              │      │             │
│    happens   │      │              │      │             │
│              │      │              │      │             │
│ 2. Build AP  │      │              │      │             │
│    activity  │      │              │      │             │
│              │      │              │      │             │
│ 3. Sign with ├──────►              │      │             │
│    HTTP Sig  │      │ 4. Deliver   ├──────► 5. Verify   │
│              │      │    via POST  │      │    signature│
│              │      │              │      │             │
│              │      │              │      │ 6. Process  │
│              │      │              │      │    activity │
│              │      │              │      │             │
│              │      │              │      │ 7. Store    │
│              │      │              │      │    content  │
└─────────────┘      └──────────────┘      └─────────────┘
```

---

## Actor Types

CommonPub registers three types of ActivityPub actors:

### Person (Users)

Every user is a `Person` actor discoverable via WebFinger.

```
@alice@hack.build  →  WebFinger  →  https://hack.build/users/alice
```

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Person",
  "id": "https://hack.build/users/alice",
  "preferredUsername": "alice",
  "name": "Alice Chen",
  "summary": "Hardware hacker, robotics enthusiast",
  "inbox": "https://hack.build/users/alice/inbox",
  "outbox": "https://hack.build/users/alice/outbox",
  "followers": "https://hack.build/users/alice/followers",
  "following": "https://hack.build/users/alice/following",
  "publicKey": {
    "id": "https://hack.build/users/alice#main-key",
    "owner": "https://hack.build/users/alice",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n..."
  },
  "endpoints": {
    "sharedInbox": "https://hack.build/inbox"
  }
}
```

### Group (Hubs — Community & Product)

Hubs are `Group` actors. This follows the [FEP-1b12](https://codeberg.org/fediverse/fep/src/branch/main/fep/1b12/fep-1b12.md) standard used by Lemmy, NodeBB, and others.

```
@robotics@hack.build  →  WebFinger  →  https://hack.build/hubs/robotics
```

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams", "...cpub..."],
  "type": "Group",
  "id": "https://hack.build/hubs/robotics",
  "preferredUsername": "robotics",
  "name": "Robotics Community",
  "summary": "Build, share, and learn about robots",
  "inbox": "https://hack.build/hubs/robotics/inbox",
  "outbox": "https://hack.build/hubs/robotics/outbox",
  "followers": "https://hack.build/hubs/robotics/followers",
  "attributedTo": ["https://hack.build/users/alice"],
  "publicKey": { "...": "..." },
  "cpub:hubType": "community",
  "cpub:joinPolicy": "open"
}
```

### Application (Instance Actor)

Every instance has an `Application` actor used for instance-level operations (mirroring, relays).

```json
{
  "type": "Application",
  "id": "https://hack.build/actor",
  "preferredUsername": "hack.build",
  "inbox": "https://hack.build/actor/inbox",
  "outbox": "https://hack.build/actor/outbox"
}
```

---

## Discovery — Finding People and Hubs

### WebFinger

Type `@alice@hack.build` into any fediverse app and it resolves the user:

```
GET https://hack.build/.well-known/webfinger?resource=acct:alice@hack.build

{
  "subject": "acct:alice@hack.build",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://hack.build/users/alice"
    }
  ]
}
```

Hubs are also discoverable: `@robotics@hack.build` resolves to the Group actor.

### NodeInfo

Instance metadata is available via NodeInfo 2.1:

```
GET https://hack.build/.well-known/nodeinfo
→ redirects to /nodeinfo/2.1

{
  "software": { "name": "commonpub", "version": "1.0.0" },
  "protocols": ["activitypub"],
  "usage": {
    "users": { "total": 150, "activeMonth": 42 },
    "localPosts": 3200
  },
  "metadata": {
    "commonpub": {
      "version": "1.0.0",
      "contentTypes": ["project", "blog", "explainer"],
      "hubTypes": ["community", "product", "company"],
      "features": ["bom", "learning", "docs"]
    }
  }
}
```

The `metadata.commonpub` block lets other CommonPub instances know what content types and features are available, enabling richer federation.

---

## Following and Feeds

### Following a Remote User

```
┌─────────────────┐                    ┌─────────────────┐
│  circuits.com   │                    │   hack.build    │
│                 │                    │                 │
│  Bob clicks     │                    │                 │
│  "Follow Alice" │                    │                 │
│        │        │                    │                 │
│        ▼        │                    │                 │
│  Send Follow ───┼────────────────────►  Alice's inbox  │
│  activity       │                    │        │        │
│                 │                    │        ▼        │
│                 │                    │  Auto-accept or │
│                 │                    │  manual approve │
│                 │                    │        │        │
│  Receive    ◄───┼────────────────────┤  Send Accept   │
│  Accept         │                    │  activity       │
│        │        │                    │                 │
│        ▼        │                    │                 │
│  Store follow   │                    │                 │
│  relationship   │                    │                 │
│                 │                    │                 │
│  From now on,   │                    │  When Alice     │
│  Bob sees       ◄───────────────────┤  publishes,     │
│  Alice's content│   Create activity  │  deliver to     │
│  in his feed    │                    │  all followers  │
└─────────────────┘                    └─────────────────┘
```

### Following a Remote Hub

Same pattern, but the Follow targets a Group actor:

```
Bob follows @robotics@hack.build
  → Follow sent to Group inbox
  → Group accepts (open hub) or queues for approval (private hub)
  → All content posted to the hub is delivered to Bob via Announce
```

### The Federated Feed

Users see three types of content in their feed:

1. **Local** — Content from users on the same instance
2. **Following** — Content from remote users/hubs they follow
3. **Federated** — All public content the instance is aware of (via follows, mirrors, relays)

---

## Content Federation

### How Content Flows

When a user publishes content, it becomes an ActivityPub object:

```
┌─────────────────────────────────────────────────────────┐
│                    Create Activity                       │
│                                                         │
│  actor: https://hack.build/users/alice                  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Article Object                   │  │
│  │                                                   │  │
│  │  type: Article                                    │  │
│  │  name: "Building a 6-DOF Robot Arm"               │  │
│  │  content: "<article>Full HTML...</article>"       │  │
│  │  summary: "A guide to building a desktop robot"   │  │
│  │  published: "2026-03-10T00:00:00Z"                │  │
│  │  attachment: [cover image]                        │  │
│  │  tag: [#robotics, #arduino]                       │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  CommonPub Extensions (cpub-to-cpub only)   │  │  │
│  │  │                                             │  │  │
│  │  │  cpub:type: "project"                       │  │  │
│  │  │  cpub:difficulty: "intermediate"            │  │  │
│  │  │  cpub:bom: [                                │  │  │
│  │  │    { name: "Arduino Nano", qty: 1,          │  │  │
│  │  │      productUri: "https://circuits.com/..." │  │  │
│  │  │    },                                       │  │  │
│  │  │    { name: "MG996R Servo", qty: 6 }         │  │  │
│  │  │  ]                                          │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Graceful Degradation

The same object is understood differently by different servers:

```
                        ┌──────────────────────┐
                        │  Alice's Project     │
                        │  (AP Article)        │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
    ┌─────────▼─────────┐ ┌───────▼────────┐ ┌────────▼────────┐
    │   CommonPub        │ │   Mastodon     │ │   Lemmy         │
    │   Instance         │ │                │ │                 │
    │                    │ │  Sees: Article │ │  Sees: Article  │
    │  Sees: Full        │ │  with title,   │ │  with title     │
    │  project view      │ │  body text,    │ │  and link       │
    │  with BOM,         │ │  cover image,  │ │                 │
    │  product links,    │ │  hashtags      │ │                 │
    │  difficulty,       │ │                │ │                 │
    │  rich rendering    │ │  (Perfectly    │ │                 │
    │                    │ │   readable)    │ │                 │
    └────────────────────┘ └────────────────┘ └─────────────────┘
```

Non-CommonPub servers ignore the `cpub:` namespace extensions and render the standard Article with title, body HTML, cover image, and tags. CommonPub instances extract the extensions and render the full rich experience.

### Content Updates and Deletions

```
Edit → Update activity with full object + updated timestamp → all followers
Delete → Delete activity with Tombstone → all followers (advisory)
```

Updates include the complete object (not a diff). Recipients replace their cached version. Deletions are advisory — the origin asks recipients to delete, but can't force it.

---

## Hub Federation (Groups)

Hubs use the FEP-1b12 **Announce pattern**, proven by Lemmy at scale. The hub (Group actor) is the central distribution point.

### Posting to a Federated Hub

```
┌──────────────────┐                    ┌──────────────────┐
│ circuits.com     │                    │ hack.build       │
│                  │                    │                  │
│ Bob writes a     │                    │                  │
│ post for the     │                    │                  │
│ Robotics hub     │                    │                  │
│       │          │                    │                  │
│       ▼          │                    │                  │
│ Create(Note)     │                    │                  │
│ with audience:   │                    │                  │
│ hack.build/hubs/ ├────────────────────► Robotics Hub     │
│ robotics         │    to hub inbox    │ Group inbox      │
│                  │                    │       │          │
│                  │                    │       ▼          │
│                  │                    │ Validate:        │
│                  │                    │ • Is Bob a       │
│                  │                    │   member? ✓      │
│                  │                    │ • Content ok? ✓  │
│                  │                    │       │          │
│                  │                    │       ▼          │
│                  │                    │ Wrap in Announce │
│                  │                    │ (hub as actor)   │
│                  │                    │       │          │
│                  │                    │       ▼          │
│         ◄────────┼────────────────────┤ Deliver to ALL  │
│                  │   Announce         │ hub followers    │
│  Store post      │                    │       │          │
│  in local hub    │                    │       ├──────────► learn.electronics
│  feed            │                    │       │          │
│                  │                    │       ├──────────► diy.makers
│                  │                    │       │          │
└──────────────────┘                    └───────┼──────────┘
                                                │
                                                ▼
                                         All instances with
                                         hub followers see
                                         the post
```

### Why the Announce Pattern?

The hub wraps every post in an `Announce` activity before distributing:

```json
{
  "type": "Announce",
  "actor": "https://hack.build/hubs/robotics",
  "object": {
    "type": "Create",
    "actor": "https://circuits.com/users/bob",
    "object": {
      "type": "Note",
      "content": "Check out my new servo driver board!",
      "audience": "https://hack.build/hubs/robotics"
    }
  }
}
```

This gives the hub **editorial control**:
- The hub decides what gets Announced (moderation)
- If a post is rejected, it's never Announced and followers never see it
- The hub can remove content by sending `Undo(Announce)`
- All followers get a consistent view of the hub's content

### Hub Moderation Across Instances

```
                    ┌──────────────────┐
                    │   Hub Moderator  │
                    │   on hack.build  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼────┐  ┌─────▼─────┐  ┌─────▼──────────┐
    │ Ban remote   │  │ Remove    │  │ Pin/unpin      │
    │ user         │  │ content   │  │ post           │
    │              │  │           │  │                │
    │ Block(actor) │  │ Announce  │  │ (local only —  │
    │ sent to all  │  │ (Delete)  │  │  not federated)│
    │ followers    │  │ sent to   │  │                │
    │              │  │ all       │  │                │
    └──────────────┘  └───────────┘  └────────────────┘
```

Moderation activities are distributed to all followers so every instance stays in sync.

### Hub Types and Federation Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│                        Hub Types                                │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Community     │  │   Product       │  │   Company       │ │
│  │   (Group)       │  │   (Group)       │  │   (Organization)│ │
│  │                 │  │                 │  │                 │ │
│  │ • Members post  │  │ • Owner posts   │  │ • Company posts │ │
│  │ • Discussion    │  │ • Members share │  │ • Followers     │ │
│  │ • Full two-way  │  │   projects      │  │   receive       │ │
│  │   participation │  │ • Product       │  │ • Read-only     │ │
│  │                 │  │   gallery auto- │  │   feed          │ │
│  │                 │  │   populated     │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  Open: anyone joins     Open: anyone follows  Open: follow only │
│  Approval: mod approves Approval: share after  (no posting)     │
│  Invite: token-gated    joining                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## BOM Federation — The Network Effect

This is unique to CommonPub. No other fediverse software does this.

When a project includes a Bill of Materials (BOM) with links to products on other instances, those links create a **federated product gallery**.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   hack.build                         circuits.community         │
│                                                                 │
│   Alice's Project: "Robot Arm"       Arduino Nano Product Page  │
│   ┌──────────────────────┐           ┌──────────────────────┐   │
│   │ Parts List (BOM):    │           │ Project Gallery:     │   │
│   │                      │           │                      │   │
│   │ • Arduino Nano ──────┼───────────┼─► Alice's Robot Arm  │   │
│   │   (from circuits.com)│  product  │   (from hack.build)  │   │
│   │                      │  gallery  │                      │   │
│   │ • MG996R Servo ×6   │   link    │ • Bob's Drone        │   │
│   │   (freeform)         │           │   (local project)    │   │
│   │                      │           │                      │   │
│   │ • 3D printed parts   │           │ • Carol's CNC        │   │
│   │   (freeform)         │           │   (from diy.makers)  │   │
│   └──────────────────────┘           └──────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works

```
1. Alice publishes project on hack.build with BOM:
   cpub:bom: [{ productUri: "https://circuits.com/products/arduino-nano" }]

2. hack.build sends Create(Article) to followers

3. circuits.community receives it, sees its own product in the BOM

4. circuits.community creates a gallery link:
   remote project → local product

5. The Arduino Nano product page on circuits.community
   now shows Alice's Robot Arm project in its gallery

6. If Alice updates or deletes her project,
   Update/Delete activities propagate the change
```

This creates a **network effect**: every project that uses a product makes that product's page more valuable. Every instance benefits from federation without any manual curation.

---

## Content Mirroring

Instance admins can set up mirrors to sync content from other instances.

### Mirror Modes

```
┌──────────────────────────────────────────────────────────────┐
│                     Mirror Modes                              │
│                                                              │
│  ┌────────────────────┐       ┌────────────────────────────┐ │
│  │  Follow-Based      │       │  Full Instance Mirror      │ │
│  │  (Default)         │       │  (Admin Opt-In)            │ │
│  │                    │       │                            │ │
│  │  Follow specific   │       │  Subscribe to instance     │ │
│  │  users and hubs.   │       │  actor. Receive ALL        │ │
│  │  Receive their     │       │  public content.           │ │
│  │  content via       │       │                            │ │
│  │  normal AP         │       │  Initial sync via outbox   │ │
│  │  delivery.         │       │  pagination. Ongoing via   │ │
│  │                    │       │  AP delivery.              │ │
│  │  No extra config   │       │                            │ │
│  │  needed.           │       │  Configurable:             │ │
│  │                    │       │  • Content type filter     │ │
│  │                    │       │  • Media caching on/off    │ │
│  │                    │       │  • Cache budget (MB)       │ │
│  └────────────────────┘       └────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Pull mirrors are one-directional (and that's the point)

A **pull mirror** is one-directional by default: your instance follows the remote
instance's actor and ingests *their* public content. The remote instance receives nothing
from you and has to do nothing — it does **not** mirror you back unless its own operator
separately sets up a pull mirror of you. So "mirror posts from B, but B doesn't mirror me"
is simply a pull mirror of B; no reciprocal step is required. (To *ask* another instance to
mirror you, see the mirror-request / "push" flow — a request the other operator approves.)

To see who is mirroring **you**, look at your instance actor's followers
(`/actor/followers`) — each follower is an instance pulling your content.

### What the outbox contains, and bounded history

The instance actor's `/actor/outbox` is a **projection of your published, public content**
(`status='published' AND visibility='public'`), not a log of past delivery attempts.
Members-only and private content never appear there. This is what a mirror's backfill
crawls, so the full public catalogue is retrievable — but **import is forward-only by
default**: creating a mirror only ingests new content from that point on.

To pull history, run **Backfill** with an explicit, bounded depth so you never accidentally
ingest an entire large instance:

- **How far back** — `sinceDays` (e.g. last 30 days); crawling stops once it pages past the cutoff.
- **Max items** — a hard cap per run (bounded by the instance's `mirrorMaxItems` ceiling).

Likewise, **Re-federate** (re-deliver your own content to current followers) is bounded by
default (last 30 days, capped) and only re-delivers everything when you explicitly choose
"all" — this avoids blasting every follower with thousands of activities at once.

### Mirror Data Flow

```
┌────────────────┐              ┌────────────────┐
│  Source         │              │  Mirror        │
│  Instance      │              │  Instance      │
│                │              │                │
│  Public        │   Follow     │  Admin enables │
│  content ──────┼──────────────►  mirroring     │
│                │   instance   │       │        │
│                │   actor      │       ▼        │
│                │              │  Initial sync: │
│  Outbox ◄──────┼──────────────┤  paginate      │
│  collection    │   GET pages  │  outbox        │
│                │              │       │        │
│                │              │       ▼        │
│                │              │  Store in      │
│  New content   │   Create     │  federated_    │
│  published ────┼──────────────►  content table │
│                │   activity   │                │
│                │              │  Media cached  │
│  Content       │   Update     │  locally       │
│  updated ──────┼──────────────►  (optional)    │
│                │   activity   │                │
│                │              │                │
│  Content       │   Delete     │  Soft-deleted  │
│  deleted ──────┼──────────────►  locally       │
│                │   activity   │                │
└────────────────┘              └────────────────┘
```

### Content Type Filtering

Mirrors can selectively sync specific content types:

```
Mirror from hack.build:
  ✓ Projects        (sync)
  ✓ Articles        (sync)
  ✗ Blog posts      (skip)
  ✓ Products        (sync)
  ✗ Learning paths  (skip — enrollment is local)
```

---

## Cross-Instance Interaction

Users can interact with content from any federated instance:

```
┌───────────────────────────────────────────────────────────┐
│                  Cross-Instance Actions                    │
│                                                           │
│  Action          AP Activity           What Happens       │
│  ──────          ───────────           ─────────────      │
│                                                           │
│  Like            Like                  Like count updates │
│                                        on origin          │
│                                                           │
│  Comment         Create(Note           Comment appears    │
│                  inReplyTo: ...)       on origin thread   │
│                                                           │
│  Bookmark        (local only)          Saved to local     │
│                                        bookmarks          │
│                                                           │
│  Share to Hub    Create(Note           Post appears in    │
│                  audience: hub)        hub feed via       │
│                                        Announce           │
│                                                           │
│  Unlike          Undo(Like)            Like removed on    │
│                                        origin             │
│                                                           │
│  Delete comment  Delete(Note)          Comment removed    │
│                                        on origin          │
└───────────────────────────────────────────────────────────┘
```

---

## Authentication Across Instances

### OAuth2 SSO (Model B)

Users can log in to Instance B using their Instance A credentials:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User on    │     │ Instance B   │     │ Instance A   │
│ Instance B   │     │ (consumer)   │     │ (provider)   │
│              │     │              │     │              │
│ Click "Login │     │              │     │              │
│ with A" ─────┼─────►              │     │              │
│              │     │ Discover     │     │              │
│              │     │ OAuth ───────┼─────►              │
│              │     │ endpoints    │     │ via WebFinger│
│              │     │ via          ◄─────┼──────────────│
│              │     │ WebFinger    │     │              │
│              │     │              │     │              │
│ Redirected ◄─┼─────┤ Redirect ───┼─────► Auth page    │
│ to A login   │     │ to A        │     │              │
│              │     │              │     │              │
│ Log in ──────┼─────┼──────────────┼─────► Verify       │
│              │     │              │     │              │
│              │     │ Callback ◄───┼─────┤ Redirect     │
│ Logged in! ◄─┼─────┤ with token  │     │ with code    │
│              │     │              │     │              │
│ Accounts are │     │ Link via     │     │              │
│ linked       │     │ federated    │     │              │
│              │     │ Accounts     │     │              │
│              │     │ table        │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

SSO creates an identity link — the user has one identity that spans instances. Content is still per-instance.

---

## Selective Federation

Instance admins have granular control over what federates:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Federation Controls                           │
│                                                                 │
│  Instance Mode:                                                 │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐                │
│  │   Open   │  │ Selective  │  │  Allowlist   │                │
│  │          │  │            │  │              │                │
│  │ All      │  │ Only what  │  │ Only with    │                │
│  │ public   │  │ admin      │  │ approved     │                │
│  │ content  │  │ enables    │  │ instances    │                │
│  │ federates│  │            │  │              │                │
│  └──────────┘  └────────────┘  └─────────────┘                │
│                                                                 │
│  Per-Content-Type:          Per-Hub:                            │
│  ✓ Projects                 ✓ Robotics Hub (federate)          │
│  ✓ Articles                 ✓ Electronics Hub (federate)       │
│  ✗ Blog posts               ✗ Internal Hub (local only)        │
│  ✓ Products                                                    │
│  ✗ Learning paths           Per-Domain:                        │
│                             ✓ circuits.community (allowed)     │
│  Per-User:                  ✗ spam.instance (blocked)          │
│  Users can opt out of       ⚠ sketchy.site (silenced)          │
│  federation entirely                                           │
│                                                                 │
│  Silenced = accept content but don't show in public feeds      │
│  Blocked = reject all activities, no communication             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interoperability with the Fediverse

CommonPub speaks standard ActivityPub. It interoperates with the entire fediverse:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│            CommonPub ←→ Fediverse Compatibility                 │
│                                                                 │
│  ┌──────────┐  Follow users, see Articles        ┌──────────┐  │
│  │          ├────────────────────────────────────►│          │  │
│  │ Common   │  Like, comment on content           │ Mastodon │  │
│  │ Pub      │◄────────────────────────────────────┤          │  │
│  │          │                                     └──────────┘  │
│  │          │  Hub ↔ Community compatibility       ┌──────────┐ │
│  │          ├────────────────────────────────────►│          │  │
│  │          │  Group Announce pattern              │  Lemmy   │  │
│  │          │◄────────────────────────────────────┤          │  │
│  │          │                                     └──────────┘  │
│  │          │  Follow users, see long articles    ┌──────────┐  │
│  │          ├────────────────────────────────────►│          │  │
│  │          │                                     │ Write    │  │
│  │          │◄────────────────────────────────────┤ Freely   │  │
│  │          │                                     └──────────┘  │
│  │          │  Follow users, see articles         ┌──────────┐  │
│  │          ├────────────────────────────────────►│          │  │
│  │          │                                     │ Misskey  │  │
│  │          │◄────────────────────────────────────┤ Akkoma   │  │
│  │          │                                     │ GoToSocial│ │
│  │          │                                     └──────────┘  │
│  └──────────┘                                                   │
│                                                                 │
│  Full fidelity (BOM, specs, learning):                          │
│  ┌──────────┐ ◄───────────────────────────────► ┌──────────┐   │
│  │ CommonPub│      cpub: namespace extensions    │ CommonPub│   │
│  │ Instance │      + standard AP fallback        │ Instance │   │
│  └──────────┘                                    └──────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What Other Apps See

| From CommonPub | Mastodon sees | Lemmy sees | Other AP apps |
|---------------|--------------|-----------|---------------|
| Project | Article with title, HTML body, cover image, tags | Article with link | Article |
| Article/Blog | Article | Article | Article |
| Hub Post | Note (standard post) | Note | Note |
| Comment | Note with inReplyTo | Note with inReplyTo | Note |
| Product | Document (may not render) | Document (may not render) | Varies |
| Hub | Group (can follow) | Community (can interact) | Group |

---

## Relay and Discovery

### Topic-Aware Relays

Standard fediverse relays broadcast everything. CommonPub relays filter by topic:

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│ hack.build   │     │    Relay Server      │     │ circuits.com │
│              │     │                      │     │              │
│ Publishes    ├─────► Topics: [project,    ├─────► Receives     │
│ project      │     │  article, product]   │     │ project      │
│ tagged       │     │ Tags: [#electronics, │     │ (matches     │
│ #electronics │     │  #robotics]          │     │  topic +     │
│              │     │                      │     │  tag)        │
│ Publishes    ├─────► Checks: does this    │     │              │
│ blog post    │     │ match topics/tags?   │     │ Does NOT     │
│              │     │                      │     │ receive blog │
│              │     │ Blog: ✗ not in       │     │ (filtered    │
│              │     │ topic list           │     │  out)        │
└──────────────┘     └──────────────────────┘     └──────────────┘
```

### Instance Directory

```
GET /api/federation/directory

[
  {
    "domain": "hack.build",
    "software": "commonpub",
    "users": 150,
    "content": 3200,
    "contentTypes": ["project", "blog"],
    "hubTypes": ["community", "product"],
    "description": "A maker community for hardware hackers"
  },
  {
    "domain": "circuits.community",
    "software": "commonpub",
    "users": 89,
    "content": 1400,
    "contentTypes": ["project", "blog", "product"],
    "hubTypes": ["product", "company"],
    "description": "Electronics and embedded systems"
  }
]
```

---

## Security Model

### HTTP Signatures

Every server-to-server request is signed:

```
POST /users/alice/inbox HTTP/1.1
Host: hack.build
Date: Thu, 20 Mar 2026 12:00:00 GMT
Digest: SHA-256=base64encodeddigest
Signature: keyId="https://circuits.com/users/bob#main-key",
           algorithm="rsa-sha256",
           headers="(request-target) host date digest",
           signature="base64encodedsignature"
Content-Type: application/activity+json

{ "type": "Follow", ... }
```

The receiving server:
1. Extracts the `keyId` from the Signature header
2. Fetches the actor document to get the public key
3. Verifies the signature against the request headers
4. Only processes the activity if the signature is valid

### SSRF Protection

When fetching remote actors, CommonPub blocks:
- Private IP ranges (10.x, 172.16–31.x, 192.168.x)
- Localhost (127.0.0.1, ::1)
- Cloud metadata endpoints (169.254.169.254)
- Non-HTTPS URLs in production

### Content Sanitization

All incoming HTML content is sanitized before storage:
- Strip: `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers
- Allow: `<p>`, `<a>`, `<img>`, headings, lists, `<blockquote>`, `<code>`, `<pre>`, `<em>`, `<strong>`
- Block: `javascript:` URLs, executable `data:` URLs

---

## Admin Controls

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Federation Panel                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Instance Status                                         │    │
│  │ Federation: ● Active     Mode: Open                     │    │
│  │ Known instances: 12      Followers: 340                 │    │
│  │ Pending deliveries: 3    Failed (24h): 0                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │ Content Federation   │  │ Instance Management          │    │
│  │                      │  │                              │    │
│  │ ✓ Projects           │  │ circuits.com    ● Allowed    │    │
│  │ ✓ Articles           │  │ learn.electro   ● Allowed    │    │
│  │ ✗ Blog posts         │  │ spam.net        ● Blocked    │    │
│  │ ✓ Products           │  │ sketchy.site    ⚠ Silenced   │    │
│  │ ✓ Explainers         │  │                              │    │
│  │ ✗ Learning paths     │  │ [+ Add instance]             │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │ Mirrors              │  │ Activity Log                 │    │
│  │                      │  │                              │    │
│  │ hack.build → full    │  │ 12:01 Create Article ✓      │    │
│  │ Last sync: 2m ago    │  │ 12:00 Follow Accept  ✓      │    │
│  │ Items: 3,200         │  │ 11:58 Like           ✓      │    │
│  │ Media: 2.1 GB / 5 GB│  │ 11:55 Announce       ✓      │    │
│  │                      │  │                              │    │
│  │ [+ Add mirror]       │  │ [View all →]                 │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Federation Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/webfinger` | GET | Actor discovery |
| `/.well-known/nodeinfo` | GET | Instance metadata discovery |
| `/nodeinfo/2.1` | GET | Instance metadata |
| `/users/[username]` | GET | Person actor (content negotiation) |
| `/users/[username]/inbox` | POST | User inbox |
| `/users/[username]/outbox` | GET | User outbox (paginated) |
| `/users/[username]/followers` | GET | Followers collection |
| `/users/[username]/following` | GET | Following collection |
| `/hubs/[slug]` | GET | Group actor (content negotiation) |
| `/hubs/[slug]/inbox` | POST | Hub inbox |
| `/hubs/[slug]/outbox` | GET | Hub outbox (paginated Announces) |
| `/hubs/[slug]/followers` | GET | Hub followers collection |
| `/inbox` | POST | Shared inbox (all actors) |
| `/actor` | GET | Instance actor |
| `/actor/inbox` | POST | Instance inbox (mirroring) |
| `/actor/outbox` | GET | Instance outbox (all public content) |

---

## Learn More

- **[Codebase analysis](../codebase-analysis/)** — exhaustive current inventory: schema, server modules, API routes, state diagrams. Always current.
- **[Developers guide](guides/developers.md)** — federation-for-developers section with implementation notes
- **[ADR 019](adr/019-federation-architecture.md)** — original architecture decision record
- **[Archived federation plan](archive/federation-plan.md)** — original 10-phase roadmap (all phases complete)
- **[Archived federation map](archive/federation-map.md)** — 2026-04-03 deep federation reference (superseded by codebase-analysis)
- **[W3C ActivityPub Spec](https://www.w3.org/TR/activitypub/)** — the protocol standard
- **[FEP-1b12](https://codeberg.org/fediverse/fep/src/branch/main/fep/1b12/fep-1b12.md)** — Group federation standard
- **[HTTP Signatures](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)** — signed inter-instance requests (CommonPub signs/verifies with `jose`; the AP layer is pure TypeScript in `@commonpub/protocol`, NOT Fedify)
