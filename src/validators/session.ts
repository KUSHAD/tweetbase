import { z } from 'zod';

export const revokeSessionSchema = z.object({
  id: z.string().cuid2().describe('Session ID to revoke'),
});
