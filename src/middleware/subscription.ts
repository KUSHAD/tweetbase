import { and, eq, gt } from 'drizzle-orm';
import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { userSubscriptions } from '../db/schema';

export const subscriptionMiddleware: MiddlewareHandler = async (c, next) => {
  const authUser = c.get('authUser');

  if (!authUser) {
    throw new HTTPException(401, {
      message: 'Unauthorized',
      cause: 'User is not authenticated',
    });
  }

  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, authUser.userId),
        eq(userSubscriptions.status, 'active'),
        gt(userSubscriptions.currentPeriodEnd, new Date()),
      ),
    );

  if (!subscription) {
    throw new HTTPException(403, {
      message: 'Forbidden',
      cause: 'No active subscription',
    });
  }

  await next();
};
