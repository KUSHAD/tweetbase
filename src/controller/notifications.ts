import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod/v4';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { errorFormat } from '../lib/utils';
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

  await db.insert(notifications).values({
    recipientId: parse.data.recipientId,
    actorId: parse.data.actorId,
    type: parse.data.type,
    tweetId: parse.data.tweetId ?? null,
    commentId: parse.data.commentId ?? null,
  });
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
  const userId = authUser.userId;

  const rows = await db
    .select({
      type: notifications.type,
      tweetId: notifications.tweetId,
      commentId: notifications.commentId,
      latestAt: sql`MAX(${notifications.createdAt})`.as('latest_at'),
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
    .innerJoin(users, sql`${users.id} = ${notifications.actorId}`)
    .where(sql`${notifications.recipientId} = ${userId}`)
    .groupBy(notifications.type, notifications.tweetId, notifications.commentId)
    .orderBy((t) => [desc(t.latestAt)])
    .limit(20);

  return rows.map((n: any) => {
    const actors = n.actors.map((a: any) => a.displayName);
    const action = getAction(n.type);

    let message: string;
    if (actors.length === 1) {
      message = `${actors[0]} ${action}`;
    } else if (actors.length === 2) {
      message = `${actors[0]} and ${actors[1]} ${action}`;
    } else {
      message = `${actors[0]}, ${actors[1]} and ${actors.length - 2} others ${action}`;
    }

    return c.json({
      message: 'Notifications Fetched Succesfuly',
      data: {
        type: n.type,
        tweetId: n.tweet_id,
        commentId: n.comment_id,
        latestAt: n.latest_at,
        actors: n.actors,
        message,
      },
    });
  });

  function getAction(type: string): string {
    switch (type) {
      case 'LIKE':
        return 'liked your tweet';
      case 'COMMENT':
        return 'commented on your tweet';
      case 'RETWEET':
        return 'retweeted your tweet';
      case 'QUOTE':
        return 'quoted your tweet';
      case 'FOLLOW':
        return 'followed you';
      default:
        return '';
    }
  }
};
