import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { users } from '../db/schema';
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
    .update(users)
    .set({ displayName, bio, website })
    .where(eq(users.id, authUser.userId))
    .returning({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
      tweetCount: users.tweetCount,
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
    .from(users)
    .where(and(eq(users.userName, userName), ne(users.id, authUser.userId)));

  if (usernameExists)
    throw new HTTPException(409, {
      message: 'Username already exists',
      cause: 'userName not unique',
    });

  const [updatedUser] = await db
    .update(users)
    .set({ userName })
    .where(eq(users.id, authUser.userId))
    .returning({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
      tweetCount: users.tweetCount,
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

  const resUsers = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
      rank: sql<number>`ts_rank(
        setweight(to_tsvector('english', ${users.userName}), 'A') ||
        setweight(to_tsvector('english', ${users.displayName}), 'B'),
        websearch_to_tsquery('english', ${searchString})
      )`,
      tweetCount: users.tweetCount,
    })
    .from(users)
    .where(
      and(
        sql`
          (
            setweight(to_tsvector('english', ${users.userName}), 'A') ||
            setweight(to_tsvector('english', ${users.displayName}), 'B')
          ) @@ websearch_to_tsquery('english', ${searchString})
        `,
        ne(users.id, authUser.userId),
      ),
    )
    .orderBy((table) => [desc(table.rank)])
    .limit(10);

  return c.json({ message: 'Profiles fetched', data: { users: resUsers } });
});

export const updateAvatar = zValidator('form', updateAvatarSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { avatar } = res.data;

  const [prevUser] = await db
    .select({ avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, authUser.userId));

  if (!prevUser)
    throw new HTTPException(404, {
      message: 'User not found',
      cause: 'Invalid userId in auth context',
    });

  const uploadedFile = await utapi.uploadFiles(avatar);

  const [user] = await db
    .update(users)
    .set({ avatarUrl: uploadedFile.data?.ufsUrl })
    .where(eq(users.id, authUser.userId))
    .returning({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
      tweetCount: users.tweetCount,
    });

  const prevKey = prevUser.avatarUrl && getUploadthingFileKey(prevUser.avatarUrl);
  if (prevKey && !prevKey.includes('4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE')) {
    await utapi.deleteFiles(prevKey);
  }

  return c.json({ message: 'Avatar uploaded successfully', data: { user } });
});

export const getProfile = zValidator('query', getProfileSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { userId } = res.data;

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
      tweetCount: users.tweetCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user)
    throw new HTTPException(404, {
      message: 'No user found',
      cause: 'No user found with the provided user id',
    });

  return c.json({ message: 'Profile fetched succesfully', data: { user } });
});
