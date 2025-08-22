import z from 'zod/v4';

export const createNotificationSchema = z.object({
  actorId: z.cuid2(),
  recipientId: z.cuid2(),
  type: z.enum(['LIKE', 'COMMENT', 'RETWEET', 'QUOTE', 'FOLLOW']),
  tweetId: z.cuid2().optional(),
  commentId: z.cuid2().optional(),
});

export const getNotificationSchema = z.object({
  id: z.cuid2(),
});
