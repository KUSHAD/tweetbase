import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { standaloneTweetComments, standaloneUsers } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { commentIdSchema, createCommentSchema } from '../validators/comment';
import { getTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';

export const createComment = zValidator('json', createCommentSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { content, tweetId } = res.data;

  const authUser = c.get('authUser');

  const [newComment] = await db
    .insert(standaloneTweetComments)
    .values({
      content,
      tweetId,
      userId: authUser.userId,
    })
    .returning({
      content: standaloneTweetComments.content,
      tweetId: standaloneTweetComments.tweetId,
      userId: standaloneTweetComments.userId,
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
      .select({ id: standaloneTweetComments.id })
      .from(standaloneTweetComments)
      .where(
        and(
          eq(standaloneTweetComments.id, commentId),
          eq(standaloneTweetComments.userId, authUser.userId),
          eq(standaloneTweetComments.tweetId, tweetId),
        ),
      );

    if (!selectedComment)
      throw new HTTPException(404, {
        message: 'Forbidden',
        cause: 'Comment not found or you do not have permission to update it',
      });

    const [updatedComment] = await db
      .update(standaloneTweetComments)
      .set({
        content: content,
      })
      .where(
        and(
          eq(standaloneTweetComments.id, commentId),
          eq(standaloneTweetComments.userId, authUser.userId),
          eq(standaloneTweetComments.tweetId, tweetId),
        ),
      )
      .returning({
        content: standaloneTweetComments.content,
        tweetId: standaloneTweetComments.tweetId,
        userId: standaloneTweetComments.userId,
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
    .select({ id: standaloneTweetComments.id })
    .from(standaloneTweetComments)
    .where(
      and(
        eq(standaloneTweetComments.id, commentId),
        eq(standaloneTweetComments.userId, authUser.userId),
      ),
    );

  if (!selectedComment)
    throw new HTTPException(404, {
      message: 'Forbidden',
      cause: 'Comment not found or you do not have permission to delete it',
    });

  const [deletedComment] = await db
    .delete(standaloneTweetComments)
    .where(
      and(
        eq(standaloneTweetComments.id, commentId),
        eq(standaloneTweetComments.userId, authUser.userId),
      ),
    )
    .returning({ id: standaloneTweetComments.id });

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
        id: standaloneTweetComments.id,
        content: standaloneTweetComments.content,
        user: {
          id: standaloneUsers.id,
          userName: standaloneUsers.userName,
          displayName: standaloneUsers.displayName,
          avatarUrl: standaloneUsers.avatarUrl,
        },
        createdAt: standaloneTweetComments.createdAt,
      })
      .from(standaloneTweetComments)
      .where(eq(standaloneTweetComments.tweetId, tweetId))
      .innerJoin(standaloneUsers, eq(standaloneUsers.id, standaloneTweetComments.userId))
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
