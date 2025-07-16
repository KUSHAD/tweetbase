import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { saasUsers } from '../db/schema';
import { utapi } from '../lib/uploadthing';
import { errorFormat, getUploadthingFileKey } from '../lib/utils';
import {
  getProfileSchema,
  profileSearchSchema,
  updateAvatarSchema,
  updateBasicInfoSchema,
  updateUsernameSchema,
} from '../validators/profile';

export const updateBasicInfo = zValidator('json', updateBasicInfoSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { displayName, bio, website } = res.data;

  const [updatedUser] = await db
    .update(saasUsers)
    .set({ displayName, bio, website })
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
      tweetCount: saasUsers.tweetCount,
    });

  return c.json({
    message: 'Profile updated successfully',
    data: { user: updatedUser },
  });
});

export const updateUsername = zValidator('json', updateUsernameSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { userName } = res.data;

  const [usernameExists] = await db
    .select()
    .from(saasUsers)
    .where(and(eq(saasUsers.userName, userName), ne(saasUsers.id, authUser.userId)));

  if (usernameExists)
    throw new HTTPException(409, {
      message: 'Username already exists',
      cause: 'userName not unique',
    });

  const [updatedUser] = await db
    .update(saasUsers)
    .set({ userName })
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
      tweetCount: saasUsers.tweetCount,
    });

  return c.json({
    message: 'Username updated successfully',
    data: { user: updatedUser },
  });
});

export const searchProfiles = zValidator('query', profileSearchSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

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
      tweetCount: saasUsers.tweetCount,
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

  return c.json({ message: 'Profiles fetched', data: { users } });
});

export const updateAvatar = zValidator('form', updateAvatarSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { avatar } = res.data;

  const [prevUser] = await db
    .select({ avatarUrl: saasUsers.avatarUrl })
    .from(saasUsers)
    .where(eq(saasUsers.id, authUser.userId));

  if (!prevUser)
    throw new HTTPException(404, {
      message: 'User not found',
      cause: 'Invalid userId in auth context',
    });

  const uploadedFile = await utapi.uploadFiles(avatar);

  const [user] = await db
    .update(saasUsers)
    .set({ avatarUrl: uploadedFile.data?.ufsUrl })
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
      tweetCount: saasUsers.tweetCount,
    });

  const prevKey = prevUser.avatarUrl && getUploadthingFileKey(prevUser.avatarUrl);
  if (prevKey && !prevKey.includes('4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE')) {
    await utapi.deleteFiles(prevKey);
  }

  return c.json({ message: 'Avatar uploaded successfully', data: { user } });
});

export const getProfile = zValidator('param', getProfileSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { userId } = res.data;

  const [user] = await db
    .select({
      id: saasUsers.id,
      displayName: saasUsers.displayName,
      userName: saasUsers.userName,
      avatarUrl: saasUsers.avatarUrl,
      bio: saasUsers.bio,
      website: saasUsers.website,
      followerCount: saasUsers.followerCount,
      followingCount: saasUsers.followingCount,
      tweetCount: saasUsers.tweetCount,
    })
    .from(saasUsers)
    .where(eq(saasUsers.id, userId))
    .limit(1);

  if (!user)
    throw new HTTPException(404, {
      message: 'No user found',
      cause: 'No user found with the provided user id',
    });

  return c.json({ message: 'Profile fetched succesfully', data: { user } });
});
