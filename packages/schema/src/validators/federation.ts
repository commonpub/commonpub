import { z } from 'zod';
import { optionalUrl } from './_shared.js';

// --- Federation validators ---

export const actorUriSchema = z.string().url().max(2048);

export const activityDirectionSchema = z.enum(['inbound', 'outbound']);
export type ActivityDirection = z.infer<typeof activityDirectionSchema>;

export const activityStatusSchema = z.enum(['pending', 'delivered', 'failed', 'processed']);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export const followRelationshipStatusSchema = z.enum(['pending', 'accepted', 'rejected']);
export type FollowRelationshipStatus = z.infer<typeof followRelationshipStatusSchema>;

export const createRemoteActorSchema = z.object({
  actorUri: actorUriSchema,
  inbox: z.string().url(),
  outbox: optionalUrl(),
  publicKeyPem: z.string().optional(),
  preferredUsername: z.string().max(64).optional(),
  displayName: z.string().max(128).optional(),
  avatarUrl: optionalUrl(),
  instanceDomain: z.string().min(1).max(255),
});
export type CreateRemoteActorInput = z.infer<typeof createRemoteActorSchema>;

export const createActivitySchema = z.object({
  type: z.string().min(1).max(64),
  actorUri: actorUriSchema,
  objectUri: actorUriSchema.optional(),
  payload: z.record(z.string(), z.unknown()),
  direction: activityDirectionSchema,
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const createFollowRelationshipSchema = z.object({
  followerActorUri: actorUriSchema,
  followingActorUri: actorUriSchema,
});
export type CreateFollowRelationshipInput = z.infer<typeof createFollowRelationshipSchema>;

export const mirrorRequestDirectionSchema = z.enum(['incoming', 'outgoing']);
export type MirrorRequestDirection = z.infer<typeof mirrorRequestDirectionSchema>;

export const mirrorRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type MirrorRequestStatus = z.infer<typeof mirrorRequestStatusSchema>;

/**
 * Body for approving an incoming mirror request — the approver's bounded depth + filters for the
 * pull mirror they create of the requester. All optional; absent depth = forward-only.
 */
export const approveMirrorRequestSchema = z.object({
  sinceDays: z.coerce.number().int().positive().max(3650).optional(),
  maxItems: z.coerce.number().int().positive().max(5000).optional(),
  filterContentTypes: z.array(z.string().max(64)).max(20).nullable().optional(),
  filterTags: z.array(z.string().max(64)).max(50).nullable().optional(),
});
export type ApproveMirrorRequestInput = z.infer<typeof approveMirrorRequestSchema>;

// --- Registry / instance directory (Phase 4) ---

export const registryInstanceStatusSchema = z.enum(['active', 'hidden', 'blocked']);
export type RegistryInstanceStatus = z.infer<typeof registryInstanceStatusSchema>;

export const registryInstanceQuerySchema = z.object({
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type RegistryInstanceQuery = z.infer<typeof registryInstanceQuerySchema>;

export const setRegistryInstanceStatusSchema = z.object({
  status: registryInstanceStatusSchema,
});
