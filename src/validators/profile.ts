import { z } from 'zod/v4';

export const updateBasicInfoSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display Name is required')
    .max(50, 'Display Name must be less than 50 characters')
    .trim(),
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
    .trim()
    .toLowerCase(),
});

export const profileSearchSchema = z.object({
  searchString: z
    .string()
    .min(1, 'Searchstring is required')
    .max(50, 'Searchstring must be less than 50 characters')
    .toLowerCase()
    .transform((val) => val.replace(/[^\w\s|&:'"!()-]/g, '').replace(/\s+/g, ' ')),
});

export const updateAvatarSchema = z.object({
  avatar: z
    .file()
    .min(1, 'Required')
    .max(1000000, 'Max 1MB')
    .mime(['image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
});

export const getProfileSchema = z.object({
  userId: z.cuid2(),
});
