import { z } from 'zod';

export const signupSchema = z
  .object({
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
    confirmPassword: z.string().min(8).max(16),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .min(3, 'Enter a valid username or email')
      .max(50, 'Too long')
      .describe('Your username or email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .refine(
    (data) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.identifier);
      const isUsername = /^[a-zA-Z0-9_]+$/.test(data.identifier);
      return isEmail || isUsername;
    },
    {
      path: ['identifier'],
      message: 'Enter a valid email or username',
    },
  );

export const logoutSchema = z.object({
  refreshToken: z.string().jwt(),
});
