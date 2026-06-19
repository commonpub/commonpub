import { z } from 'zod';

// --- Messaging validators ---

export const createConversationSchema = z.object({
  participants: z.array(z.string().uuid()).min(1).max(50),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
