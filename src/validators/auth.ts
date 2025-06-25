import { z } from 'zod';

export const signupSchema = z.object({
  displayName: z.string().min(2).max(50).describe('This is your display name`'),
  userName: z
    .string()
    .min(4, 'Username must be at least 4 characters')
    .max(15, 'Username must be 15 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .describe('This is how your friends will find you')
    .transform((val) => val.toLowerCase()),
  email: z.string().email(),
  password: z.string().min(8).max(16),
});
