import { z } from 'zod/v4';

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Required').max(50, 'Max length is 50 characters'),
  tweetId: z.cuid2(),
});

export const commentIdSchema = z.object({
  commentId: z.cuid2(),
});
