import { z } from 'zod/v4';

export const revokeSessionSchema = z.object({
  id: z.cuid2().describe('Session ID to revoke'),
});
