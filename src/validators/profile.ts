import { z } from 'zod';

export const updateBasicInfoSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display Name is required')
    .max(50, 'Display Name must be less than 50 characters'),
  bio: z.string().max(100, 'Bio must be less than 100 characters').optional(),
  website: z
    .string()
    .url('Invalid URL format')
    .max(100, 'Website must be less than 100 characters')
    .optional(),
});

export const updateUsernameSchema = z.object({
  userName: z
    .string()
    .min(4, 'Username must be at least 4 characters')
    .max(15, 'Username must be 15 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .transform((val) => val.toLowerCase()),
});
