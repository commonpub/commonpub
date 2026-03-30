# Session 092 — Remaining Work Plan

## Phase A: Wire Hub Mirroring End-to-End (NEXT)

| Step | Task | Depends On | Est |
|------|------|-----------|-----|
| A1 | ~~Outbound Follow delivery~~ | DONE | sendHubFollow() queues Follow from Service actor |
| A2 | ~~Inbox: Accept(Follow) for hubs~~ | DONE | onAccept checks federatedHubs, calls acceptHubFollow() |
| A3 | ~~Inbox: Announce from Group~~ | DONE | onAnnounce dereferences Note, calls ingestFederatedHubPost() |
| A4 | ~~Inbox: Delete from Group~~ | DONE | onDelete calls deleteFederatedHubPost() |
| A5 | Hub outbox backfill — reuse backfillFromOutbox() with hub-specific ingestion | A2 | 45m |
| A6 | Database migration — drizzle-kit push on both instances | schema done | 10m |
| A7 | End-to-end test — manual: create hub on cpub.io, mirror from deveco.io | all above | 30m |

## Phase B: Federated Hub Interactions

| Step | Task | Est |
|------|------|-----|
| B1 | Like federated hub posts — UI + endpoint + outbound Like activity | 1h |
| B2 | Reply to federated hub posts — reply form + federation/reply routing | 45m |
| B3 | Federated hub join — Follow Group actor from user (FEP-1b12) | 1h |

## Phase C: Content Interaction Polish

| Step | Task | Est |
|------|------|-----|
| C1 | Boost button on mirror pages — wire existing endpoint to UI | 20m |
| C2 | Follow federated content author — extract actor URI, wire follow | 30m |
| C3 | Fork federated content — new endpoint, schema for fork source | 2h |

## Phase D: Indexes and Performance

| Step | Task | Est |
|------|------|-----|
| D1 | Add missing indexes — federatedHubs.name, (status,isHidden) composite, remoteActorId | 10m |
| D2 | Share card backfill migration — convert N+1 runtime to SQL migration | 30m |

## Phase E: Tests

| Step | Task | Est |
|------|------|-----|
| E1 | Hub mirroring unit tests — upsert, list, accept, follow | 1.5h |
| E2 | Engagement routing tests — useEngagement with/without federation | 45m |
| E3 | Comment federation tests — federated reply, immediate skip | 30m |
| E4 | listHubs merge tests — pagination, sort, total count | 45m |

## Phase F: Repo Sync Automation

| Step | Task | Est |
|------|------|-----|
| F1 | Shared dependency or sync script — stop manual file copying | 2h |
