import { zValidator } from '@hono/zod-validator';
import { signupSchema } from '../validators/auth';

export const signup = zValidator('json', signupSchema, (result, c) => {
  if (!result.success) {
    return c.json(
      {
        message: 'Validation failed',
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      400,
    );
  }
  try {
    return c.json({
      message: 'Signup successful',
      data: result.data,
    });
  } catch (error) {
    return c.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
