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

export const updateComment = zValidator('param', commentIdSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { commentId } = res.data;

  const commentContent = createCommentSchema.safeParse(c.req.json());

  if (!commentContent.success) throw new HTTPException(400, errorFormat(commentContent.error));

  const authUser = c.get('authUser');

  const [selectedComment] = await db
    .select({ id: standaloneTweetComments.id })
    .from(standaloneTweetComments)
    .where(
      and(
        eq(standaloneTweetComments.id, commentId),
        eq(standaloneTweetComments.userId, authUser.userId),
        eq(standaloneTweetComments.tweetId, commentContent.data.tweetId),
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
      content: commentContent.data.content,
    })
    .where(
      and(
        eq(standaloneTweetComments.id, commentId),
        eq(standaloneTweetComments.userId, authUser.userId),
        eq(standaloneTweetComments.tweetId, commentContent.data.tweetId),
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
});

export const deleteComment = zValidator('param', commentIdSchema, async (res, c) => {
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

export const getCommentsByTweetId = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { tweetId } = res.data;
  const parsedPagination = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!parsedPagination.success) throw new HTTPException(400, errorFormat(parsedPagination.error));

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
    .offset(parsedPagination.data.offset)
    .limit(parsedPagination.data.limit + 1);

  const hasMore = comments.length > parsedPagination.data.limit;
  const data = hasMore ? comments.slice(0, -1) : comments;

  return c.json({
    message: 'Comments fetched successfully',
    data: {
      comments: data,
      hasMore,
      nextOffset: parsedPagination.data.offset + data.length,
    },
  });
});
