import { and, eq, gt } from 'drizzle-orm';
import { createUploadthing, UploadThingError, UTApi, type FileRouter } from 'uploadthing/server';
import { z } from 'zod';
import { db } from '../db';
import { saasSessions, saasUsers } from '../db/schema';
import { decryptAccessToken } from './utils';

const f = createUploadthing();

export const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

export const ourFileRouter = {
  avatarUrl: f({
    image: {
      maxFileSize: '1MB',
      maxFileCount: 1,
      minFileCount: 1,
      additionalProperties: {
        height: 300,
        width: 300,
      },
    },
  })
    .input(
      z.object({
        accessToken: z.string().jwt(),
      }),
    )
    .middleware(async ({ input }) => {
      const payload = await decryptAccessToken(input.accessToken);
      if (!payload)
        throw new UploadThingError({
          code: 'BAD_REQUEST',
          message: 'Unauthorized',
        });

      const [user] = await db
        .select({ userId: saasUsers.id, avatarUrl: saasUsers.avatarUrl })
        .from(saasUsers)
        .where(and(eq(saasUsers.id, payload.userId), eq(saasUsers.accountId, payload.accountId)));

      if (!user)
        throw new UploadThingError({
          code: 'BAD_REQUEST',
          message: 'Unauthorized',
        });

      const [session] = await db
        .select()
        .from(saasSessions)
        .where(
          and(
            eq(saasSessions.userId, payload.userId),
            eq(saasSessions.accountId, payload.accountId),
            gt(saasSessions.expiresAt, new Date()), // session must not be expired
          ),
        )
        .limit(1);

      if (!session)
        throw new UploadThingError({
          code: 'BAD_REQUEST',
          message: 'Unauthorized',
        });

      return {
        userId: user.userId,
        prevImageUrl: user.avatarUrl,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .update(saasUsers)
        .set({
          avatarUrl: file.ufsUrl,
        })
        .where(eq(saasUsers.id, metadata.userId))
        .returning();

      if (!metadata.prevImageUrl?.includes('4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE')) {
        const prevFileKey = metadata.prevImageUrl?.split('/f/')[1]!;
        await utapi.deleteFiles(prevFileKey);

        return { url: file.ufsUrl };
      }

      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;
