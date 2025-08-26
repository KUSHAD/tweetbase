import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, max, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod/v4';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { pusher } from '../lib/pusher';
import { errorFormat, getNotificationAction } from '../lib/utils';
import { createNotificationSchema, getNotificationSchema } from '../validators/notifications';

export async function createNotification(payload: z.infer<typeof createNotificationSchema>) {
  if (payload.recipientId === payload.actorId) {
    return;
  }

  const parse = createNotificationSchema.safeParse(payload);

  if (!parse.success) {
    console.error('Invalid notification data:', parse.error);
    return;
  }

  const [inserted] = await db
    .insert(notifications)
    .values({
      recipientId: parse.data.recipientId,
      actorId: parse.data.actorId,
      type: parse.data.type,
      tweetId: parse.data.tweetId ?? null,
      commentId: parse.data.commentId ?? null,
    })
    .returning();

  await pusher.trigger(`private-user-${parse.data.recipientId}`, 'new-notification', {
    id: inserted.id,
    type: inserted.type,
    actorId: inserted.actorId,
    tweetId: inserted.tweetId,
    commentId: inserted.commentId,
    createdAt: inserted.createdAt,
  });

  return inserted;
}

export const markAsRead = zValidator('query', getNotificationSchema, async (result, c) => {
  if (!result.success) throw new HTTPException(400, errorFormat(result.error));

  const { id } = result.data;
  const authUser = c.get('authUser');

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, authUser.userId)));

  return c.json({
    message: 'Notification Marked read',
    data: {
      notificationId: id,
    },
  });
});

export const getUserNotifications = async (c: Context) => {
  const authUser = c.get('authUser');

  if (!authUser) {
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });
  }

  const userId = authUser.userId;

  const rows = await db
    .select({
      type: notifications.type,
      tweetId: notifications.tweetId,
      commentId: notifications.commentId,
      latestAt: max(notifications.createdAt).as('latestAt'),
      actors: sql`
        json_agg(
          json_build_object(
            'id', ${users.id},
            'userName', ${users.userName},
            'displayName', ${users.displayName},
            'avatarUrl', ${users.avatarUrl}
          )
        )
      `.as('actors'),
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.recipientId, userId))
    .groupBy(notifications.type, notifications.tweetId, notifications.commentId)
    .orderBy(desc(sql`latestAt`))
    .limit(20);

  // Format into clean response
  const data = rows.map((n: any) => {
    const parsedActors = Array.isArray(n.actors) ? n.actors : JSON.parse(n.actors ?? '[]');

    const actorNames = parsedActors.map((a: any) => a.displayName);
    const action = getNotificationAction(n.type);

    let message: string;
    if (actorNames.length === 1) {
      message = `${actorNames[0]} ${action}`;
    } else if (actorNames.length === 2) {
      message = `${actorNames[0]} and ${actorNames[1]} ${action}`;
    } else {
      message = `${actorNames[0]}, ${actorNames[1]} and ${actorNames.length - 2} others ${action}`;
    }

    return {
      type: n.type,
      tweetId: n.tweetId,
      commentId: n.commentId,
      latestAt: n.latestAt,
      actors: parsedActors,
      message,
    };
  });

  return c.json({
    message: 'Notifications fetched successfully',
    data,
  });
};
