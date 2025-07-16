import { z } from 'zod/v4';

export const paginationSchema = z.object({
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(20).default(10),
});
