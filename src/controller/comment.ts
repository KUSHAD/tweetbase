import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { tweetComments, users } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { commentIdSchema, createCommentSchema } from '../validators/comment';
import { getTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';

export const createComment = zValidator('json', createCommentSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { content, tweetId } = res.data;

  const authUser = c.get('authUser');

  const [newComment] = await db
    .insert(tweetComments)
    .values({
      content,
      tweetId,
      userId: authUser.userId,
    })
    .returning({
      content: tweetComments.content,
      tweetId: tweetComments.tweetId,
      userId: tweetComments.userId,
    });

  return c.json({
    message: 'Comment created successfully',
    data: {
      comment: newComment,
    },
  });
});

export const updateComment = zValidator(
  'query',
  commentIdSchema.and(createCommentSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const { commentId, content, tweetId } = res.data;

    const authUser = c.get('authUser');

    const [selectedComment] = await db
      .select({ id: tweetComments.id })
      .from(tweetComments)
      .where(
        and(
          eq(tweetComments.id, commentId),
          eq(tweetComments.userId, authUser.userId),
          eq(tweetComments.tweetId, tweetId),
        ),
      );

    if (!selectedComment)
      throw new HTTPException(404, {
        message: 'Forbidden',
        cause: 'Comment not found or you do not have permission to update it',
      });

    const [updatedComment] = await db
      .update(tweetComments)
      .set({
        content: content,
      })
      .where(
        and(
          eq(tweetComments.id, commentId),
          eq(tweetComments.userId, authUser.userId),
          eq(tweetComments.tweetId, tweetId),
        ),
      )
      .returning({
        content: tweetComments.content,
        tweetId: tweetComments.tweetId,
        userId: tweetComments.userId,
      });

    return c.json({
      message: 'Comment updated successfully',
      data: {
        comment: updatedComment,
      },
    });
  },
);

export const deleteComment = zValidator('query', commentIdSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { commentId } = res.data;

  const authUser = c.get('authUser');

  const [selectedComment] = await db
    .select({ id: tweetComments.id })
    .from(tweetComments)
    .where(and(eq(tweetComments.id, commentId), eq(tweetComments.userId, authUser.userId)));

  if (!selectedComment)
    throw new HTTPException(404, {
      message: 'Forbidden',
      cause: 'Comment not found or you do not have permission to delete it',
    });

  const [deletedComment] = await db
    .delete(tweetComments)
    .where(and(eq(tweetComments.id, commentId), eq(tweetComments.userId, authUser.userId)))
    .returning({ id: tweetComments.id });

  return c.json({
    message: 'Comment deleted successfully',
    data: {
      commentId: deletedComment.id,
    },
  });
});

export const getCommentsByTweetId = zValidator(
  'query',
  getTweetSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const { tweetId, limit, offset } = res.data;

    const comments = await db
      .select({
        id: tweetComments.id,
        content: tweetComments.content,
        user: {
          id: users.id,
          userName: users.userName,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
        createdAt: tweetComments.createdAt,
      })
      .from(tweetComments)
      .where(eq(tweetComments.tweetId, tweetId))
      .innerJoin(users, eq(users.id, tweetComments.userId))
      .orderBy((t) => desc(t.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = comments.length > limit;
    const data = hasMore ? comments.slice(0, -1) : comments;

    return c.json({
      message: 'Comments fetched successfully',
      data: {
        comments: data,
        hasMore,
        nextOffset: offset + data.length,
      },
    });
  },
);
