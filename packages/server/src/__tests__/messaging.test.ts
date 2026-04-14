import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { DB } from '../types.js';
import { createTestDB, createTestUser, closeTestDB } from './helpers/testdb.js';
import {
  listConversations,
  getConversationMessages,
  getConversationUnreadCounts,
  getUnreadMessageCount,
  createConversation,
  findOrCreateConversation,
  sendMessage,
  markMessagesRead,
} from '../messaging/messaging.js';

describe('messaging', () => {
  let db: DB;
  let aliceId: string;
  let bobId: string;
  let carolId: string;

  beforeAll(async () => {
    db = await createTestDB();
    const alice = await createTestUser(db, { username: 'alice' });
    aliceId = alice.id;
    const bob = await createTestUser(db, { username: 'bob' });
    bobId = bob.id;
    const carol = await createTestUser(db, { username: 'carol' });
    carolId = carol.id;
  });

  afterAll(async () => {
    await closeTestDB(db);
  });

  it('creates a conversation', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    expect(conv.id).toBeDefined();
    expect(conv.participants).toContain(aliceId);
    expect(conv.participants).toContain(bobId);
    expect(conv.lastMessageAt).toBeInstanceOf(Date);
  });

  it('rejects conversation with invalid participant IDs', async () => {
    await expect(
      createConversation(db, [aliceId, '00000000-0000-0000-0000-000000000000']),
    ).rejects.toThrow();
  });

  it('findOrCreateConversation creates new if none exists', async () => {
    const conv = await findOrCreateConversation(db, [aliceId, carolId]);
    expect(conv.id).toBeDefined();
    expect(conv.participants).toContain(aliceId);
    expect(conv.participants).toContain(carolId);
  });

  it('findOrCreateConversation returns existing when participants are in different order', async () => {
    // Create with [alice, carol] order
    const conv1 = await findOrCreateConversation(db, [aliceId, carolId]);
    // Find with [carol, alice] reversed order — should match via sorted comparison
    const conv2 = await findOrCreateConversation(db, [carolId, aliceId]);
    expect(conv1.id).toBe(conv2.id);
    // Also verify a third call doesn't create yet another conversation
    const conv3 = await findOrCreateConversation(db, [carolId, aliceId]);
    expect(conv3.id).toBe(conv1.id);
  });

  it('sends a message to a conversation', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    const msg = await sendMessage(db, conv.id, aliceId, 'Hello Bob!');
    expect(msg.id).toBeDefined();
    expect(msg.conversationId).toBe(conv.id);
    expect(msg.senderId).toBe(aliceId);
    expect(msg.body).toBe('Hello Bob!');
    expect(msg.readAt).toBeNull();
  });

  it('rejects message from non-participant', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await expect(sendMessage(db, conv.id, carolId, 'Sneaky!')).rejects.toThrow(
      'Not a participant',
    );
  });

  it('updates conversation lastMessage on send', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'First message');
    await sendMessage(db, conv.id, bobId, 'Second message');
    const convos = await listConversations(db, aliceId);
    const updated = convos.find((c) => c.id === conv.id);
    expect(updated?.lastMessage).toBe('Second message');
  });

  it('truncates long lastMessage to 200 chars with ellipsis', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    const longMsg = 'a'.repeat(250);
    await sendMessage(db, conv.id, aliceId, longMsg);
    const convos = await listConversations(db, aliceId);
    const updated = convos.find((c) => c.id === conv.id);
    expect(updated?.lastMessage).toBe('a'.repeat(200) + '...');
    expect(updated?.lastMessage?.length).toBe(203);
  });

  it('lists conversations for a user', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Test');
    const convos = await listConversations(db, aliceId);
    expect(convos.length).toBeGreaterThan(0);
    const found = convos.find((c) => c.id === conv.id);
    expect(found).toBeDefined();
  });

  it('does not list conversations for non-participants', async () => {
    // Carol should not see alice-bob conversations (only her own)
    const convos = await listConversations(db, carolId);
    const aliceBobConvos = convos.filter(
      (c) => c.participants.includes(aliceId) && c.participants.includes(bobId) && !c.participants.includes(carolId),
    );
    expect(aliceBobConvos.length).toBe(0);
  });

  it('gets messages for a conversation', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Hello');
    await sendMessage(db, conv.id, bobId, 'Hi back');
    const msgs = await getConversationMessages(db, conv.id, aliceId);
    expect(msgs.length).toBe(2);
    expect(msgs[0]!.body).toBe('Hello');
    expect(msgs[1]!.body).toBe('Hi back');
  });

  it('returns empty array for non-participant message access', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Secret');
    const msgs = await getConversationMessages(db, conv.id, carolId);
    expect(msgs).toEqual([]);
  });

  it('marks messages as read', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Read me');
    await markMessagesRead(db, conv.id, bobId);
    const msgs = await getConversationMessages(db, conv.id, bobId);
    const readMsg = msgs.find((m) => m.body === 'Read me');
    expect(readMsg?.readAt).toBeInstanceOf(Date);
  });

  it('does not mark own messages as read', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'My own msg');
    await markMessagesRead(db, conv.id, aliceId);
    const msgs = await getConversationMessages(db, conv.id, aliceId);
    const ownMsg = msgs.find((m) => m.body === 'My own msg');
    expect(ownMsg?.readAt).toBeNull();
  });

  it('respects pagination in listConversations', async () => {
    const convos = await listConversations(db, aliceId, { limit: 2, offset: 0 });
    expect(convos.length).toBeLessThanOrEqual(2);
  });

  it('group chat: per-participant read tracking', async () => {
    // Alice, Bob, Carol in a group — Carol sends messages
    const group = await createConversation(db, [aliceId, bobId, carolId]);
    await sendMessage(db, group.id, carolId, 'Group hello');
    await sendMessage(db, group.id, carolId, 'Second msg');

    // Before anyone reads: Alice and Bob each have 2 unread
    const aliceUnread1 = await getUnreadMessageCount(db, aliceId);
    const bobUnread1 = await getUnreadMessageCount(db, bobId);
    expect(aliceUnread1).toBeGreaterThanOrEqual(2);
    expect(bobUnread1).toBeGreaterThanOrEqual(2);

    // Alice reads the conversation
    await markMessagesRead(db, group.id, aliceId);

    // Alice's unread drops, Bob's stays the same
    const aliceUnread2 = await getUnreadMessageCount(db, aliceId);
    const bobUnread2 = await getUnreadMessageCount(db, bobId);
    expect(aliceUnread2).toBe(aliceUnread1 - 2);
    expect(bobUnread2).toBe(bobUnread1); // Bob unaffected by Alice reading

    // Bob reads — now Bob's drops too
    await markMessagesRead(db, group.id, bobId);
    const bobUnread3 = await getUnreadMessageCount(db, bobId);
    expect(bobUnread3).toBe(bobUnread1 - 2);
  });

  it('group chat: per-conversation unread counts are independent', async () => {
    const group = await createConversation(db, [aliceId, bobId, carolId]);
    await sendMessage(db, group.id, bobId, 'Hey group');

    // Carol has 1 unread in this conversation
    const carolCounts = await getConversationUnreadCounts(db, carolId);
    expect(carolCounts[group.id]).toBe(1);

    // Alice marks read — Carol still has 1 unread
    await markMessagesRead(db, group.id, aliceId);
    const carolCounts2 = await getConversationUnreadCounts(db, carolId);
    expect(carolCounts2[group.id]).toBe(1);

    // Carol marks read — Carol has 0 unread
    await markMessagesRead(db, group.id, carolId);
    const carolCounts3 = await getConversationUnreadCounts(db, carolId);
    expect(carolCounts3[group.id]).toBeUndefined(); // 0 = not in map
  });

  it('markMessagesRead is idempotent', async () => {
    const conv = await createConversation(db, [aliceId, bobId]);
    await sendMessage(db, conv.id, aliceId, 'Idempotent test');
    await markMessagesRead(db, conv.id, bobId);
    await markMessagesRead(db, conv.id, bobId); // second call should not throw
    const msgs = await getConversationMessages(db, conv.id, bobId);
    const msg = msgs.find((m) => m.body === 'Idempotent test');
    expect(msg?.readAt).toBeInstanceOf(Date);
  });
});
