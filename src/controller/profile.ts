import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import { saasUsers } from '../db/schema';
import { utapi } from '../lib/uploadthing';
import { errorFormat } from '../lib/utils';
import {
  profileSearchSchema,
  updateAvatarSchema,
  updateBasicInfoSchema,
  updateUsernameSchema,
} from '../validators/profile';

export const updateBasicInfo = zValidator('json', updateBasicInfoSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { displayName, bio, website } = res.data;

    const [updatedUser] = await db
      .update(saasUsers)
      .set({
        displayName,
        bio,
        website,
      })
      .where(eq(saasUsers.id, authUser.userId))
      .returning({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
        bio: saasUsers.bio,
        website: saasUsers.website,
        followerCount: saasUsers.followerCount,
        followingCount: saasUsers.followingCount,
      });

    return c.json({
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const updateUsername = zValidator('json', updateUsernameSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { userName } = res.data;

    const [usernameExists] = await db
      .select()
      .from(saasUsers)
      .where(and(eq(saasUsers.userName, userName), ne(saasUsers.id, authUser.userId)));

    if (usernameExists) return c.json({ error: 'Username already exists' }, 409);

    const [updatedUser] = await db
      .update(saasUsers)
      .set({
        userName,
      })
      .where(eq(saasUsers.id, authUser.userId))
      .returning({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
        bio: saasUsers.bio,
        website: saasUsers.website,
        followerCount: saasUsers.followerCount,
        followingCount: saasUsers.followingCount,
      });

    return c.json({
      message: 'Username updated successfully',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const searchProfiles = zValidator('json', profileSearchSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { searchString } = res.data;

    const users = await db
      .select({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
        bio: saasUsers.bio,
        website: saasUsers.website,
        followerCount: saasUsers.followerCount,
        followingCount: saasUsers.followingCount,
        rank: sql<number>`ts_rank(
          setweight(to_tsvector('english', ${saasUsers.userName}), 'A') ||
          setweight(to_tsvector('english', ${saasUsers.displayName}), 'B'),
          websearch_to_tsquery('english', ${searchString})
        )`,
      })
      .from(saasUsers)
      .where(
        and(
          sql`
            (
              setweight(to_tsvector('english', ${saasUsers.userName}), 'A') ||
              setweight(to_tsvector('english', ${saasUsers.displayName}), 'B')
            ) @@ websearch_to_tsquery('english', ${searchString})
          `,
          ne(saasUsers.id, authUser.userId),
        ),
      )
      .orderBy((table) => [desc(table.rank)]);

    return c.json({
      message: 'Profiles fetched!',
      data: {
        users,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const updateAvatar = zValidator('form', updateAvatarSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  try {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { avatar } = res.data;

    const [prevUser] = await db
      .select({
        avatarUrl: saasUsers.avatarUrl,
      })
      .from(saasUsers)
      .where(eq(saasUsers.id, authUser.userId));

    if (!prevUser) return c.json({ error: 'Unauthorized' }, 401);

    const uploadedFile = await utapi.uploadFiles(avatar);

    const [user] = await db
      .update(saasUsers)
      .set({
        avatarUrl: uploadedFile.data?.ufsUrl,
      })
      .where(eq(saasUsers.id, authUser.userId))
      .returning({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
        bio: saasUsers.bio,
        website: saasUsers.website,
        followerCount: saasUsers.followerCount,
        followingCount: saasUsers.followingCount,
      });

    if (!prevUser.avatarUrl?.includes('4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE')) {
      const prevFileKey = prevUser.avatarUrl?.split('/f/')[1]!;
      await utapi.deleteFiles(prevFileKey);

      return c.json({ message: 'Avatar Uploaded Succesfully!', data: { user } });
    }

    return c.json({ message: 'Avatar Uploaded Succesfully!', data: { user } });
  } catch (err) {
    return c.json(errorFormat(err), 500);
  }
});
