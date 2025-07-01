import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import { saasAccounts, saasUsers } from '../db/schema';
import { utapi } from '../lib/uploadthing';
import { errorFormat } from '../lib/utils';
import {
  profileSearchSchema,
  updateAccountTypeSchema,
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
      .returning();

    return c.json({
      message: 'Profile updated successfully',
      user: updatedUser,
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
      .returning();

    return c.json({
      message: 'Username updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const searchProfiles = zValidator('query', profileSearchSchema, async (res, c) => {
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
        accountId: saasUsers.accountId,
        bio: saasUsers.bio,
        website: saasUsers.website,
        rank: sql`ts_rank(
          setweight(to_tsvector('english', ${saasUsers.userName}), 'A') ||
          setweight(to_tsvector('english', ${saasUsers.displayName}), 'B'),
          websearch_to_tsquery('english', ${searchString})
        )`.mapWith(Number),
        createdAt: saasUsers.createdAt,
        updatedAt: saasUsers.updatedAt,
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
      users,
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
      .returning();

    if (!prevUser.avatarUrl?.includes('4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE')) {
      const prevFileKey = prevUser.avatarUrl?.split('/f/')[1]!;
      await utapi.deleteFiles(prevFileKey);

      return c.json({ message: 'Avatar Uploaded Succesfully!', user });
    }

    return c.json({ message: 'Avatar Uploaded Succesfully!', user });
  } catch (err) {
    return c.json(errorFormat(err), 500);
  }
});

export const updateAccountType = zValidator('json', updateAccountTypeSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const authUser = c.get('authUser');
    if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

    const { accountType } = res.data;

    await db
      .update(saasAccounts)
      .set({
        accountType,
      })
      .where(eq(saasAccounts.id, authUser.accountId));

    const [updatedUser] = await db
      .select({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
        bio: saasUsers.bio,
        website: saasUsers.website,
      })
      .from(saasUsers)
      .where(eq(saasUsers.id, authUser.userId));

    return c.json({
      message: 'Account Type Updated!',
      user: updatedUser,
    });
  } catch (err) {
    return c.json(errorFormat(err), 500);
  }
});
