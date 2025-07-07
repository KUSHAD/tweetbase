import { z } from 'zod/v4';

export const newTweetSchema = z.object({
  content: z.string().min(1, 'Required').max(280, 'Max 280 characters'),
  media: z
    .file()
    .max(4000000, 'Max 4MB')
    .mime(['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
    .optional(),
});

export const getTweetSchema = z.object({
  tweetId: z.cuid2(),
});
