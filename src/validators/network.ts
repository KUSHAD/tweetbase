import z from 'zod/v4';

export const followSchema = z.object({
  targetUserId: z.cuid2(),
});
