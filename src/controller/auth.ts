import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';
import { and, eq } from 'drizzle-orm';
import { Context } from 'hono';
import { db } from '../db';
import { accounts, refreshTokens, users } from '../db/schema';
import { errorFormat, generateAccessToken, generateRefreshToken } from '../lib/utils';
import { loginSchema, logoutSchema, signupSchema } from '../validators/auth';

export const signup = zValidator('json', signupSchema, async (result, c) => {
  if (!result.success) {
    return c.json(errorFormat(result.error), 400);
  }
  try {
    const { displayName, userName, email, password } = result.data;

    const userNameExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.userName, userName))
      .limit(1);

    if (userNameExists.length > 0) {
      return c.json(
        {
          message: 'Username already exists',
        },
        400,
      );
    }

    const emailExists = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);

    if (emailExists.length > 0) {
      return c.json(
        {
          message: 'Email already exists',
        },
        400,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newAccount = await db
      .insert(accounts)
      .values({
        email,
        passwordHash,
      })
      .returning({
        id: accounts.id,
        accountType: accounts.accountType,
        email: accounts.email,
      });

    const newUser = await db
      .insert(users)
      .values({
        accountId: newAccount[0].id,
        displayName,
        userName,
      })
      .returning({
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        website: users.website,
      });

    const accessToken = await generateAccessToken({
      userId: newUser[0].id,
      accountId: newAccount[0].id,
    });

    const refreshToken = await generateRefreshToken({
      userId: newUser[0].id,
      accountId: newAccount[0].id,
    });

    const expiresAt = addDays(new Date(), 30);

    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: newUser[0].id,
      accountId: newAccount[0].id,
      expiresAt,
    });

    return c.json({
      message: 'Signup successful',
      data: {
        refreshToken,
        accessToken,
        user: {
          ...newUser[0],
          email: newAccount[0].email,
          accountType: newAccount[0].accountType,
        },
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const login = zValidator('json', loginSchema, async (result, c) => {
  if (!result.success) {
    return c.json(errorFormat(result.error), 400);
  }

  const { identifier, password } = result.data;

  try {
    const userRecord = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        website: users.website,
        accountId: users.accountId,
      })
      .from(users)
      .where(eq(users.userName, identifier))
      .limit(1);

    let user = userRecord[0];

    let account;

    if (!user) {
      const accountRecord = await db
        .select({
          id: accounts.id,
          passwordHash: accounts.passwordHash,
          email: accounts.email,
          accountType: accounts.accountType,
        })
        .from(accounts)
        .where(eq(accounts.email, identifier))
        .limit(1);

      account = accountRecord[0];

      if (!account) {
        return c.json({ message: 'Invalid credentials' }, 401);
      }

      const userByAccount = await db
        .select({
          userId: users.id,
          displayName: users.displayName,
          userName: users.userName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          website: users.website,
          accountId: users.accountId,
        })
        .from(users)
        .where(eq(users.accountId, account.id))
        .limit(1);

      if (!userByAccount[0]) {
        return c.json({ message: 'User not found for this account' }, 404);
      }

      user = userByAccount[0];
    } else {
      const accountRecord = await db
        .select({
          id: accounts.id,
          passwordHash: accounts.passwordHash,
          email: accounts.email,
          accountType: accounts.accountType,
        })
        .from(accounts)
        .where(eq(accounts.id, user.accountId))
        .limit(1);

      account = accountRecord[0];

      if (!account) {
        return c.json({ message: 'Account not found' }, 404);
      }
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      return c.json({ message: 'Invalid credentials' }, 401);
    }

    const accessToken = await generateAccessToken({
      userId: user.userId,
      accountId: account.id,
    });

    const refreshToken = await generateRefreshToken({
      userId: user.userId,
      accountId: account.id,
    });

    const expiresAt = addDays(new Date(), 30);

    await db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.userId, user.userId), eq(refreshTokens.accountId, account.id)));

    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: user.userId,
      accountId: account.id,
      expiresAt,
    });

    return c.json({
      message: 'Login successful',
      data: {
        refreshToken,
        accessToken,
        user: {
          id: user.userId,
          displayName: user.displayName,
          userName: user.userName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          website: user.website,
          email: account.email,
          accountType: account.accountType,
        },
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const logout = zValidator('json', logoutSchema, async (result, c) => {
  if (!result.success) {
    return c.json(errorFormat(result.error), 400);
  }

  const { refreshToken } = result.data;

  try {
    const authUser = c.get('authUser');

    const tokenRecord = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.userId, authUser.userId),
          eq(refreshTokens.accountId, authUser.accountId),
        ),
      )
      .limit(1);

    if (!tokenRecord[0]) {
      return c.json({ message: 'Invalid refresh token' }, 401);
    }

    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord[0].id));

    return c.json({ message: 'Logout successful' });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const rotateRefreshToken = zValidator('json', logoutSchema, async (result, c) => {
  if (!result.success) {
    return c.json(errorFormat(result.error), 400);
  }

  const { refreshToken } = result.data;

  try {
    const tokenRecord = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1);

    if (!tokenRecord[0]) {
      return c.json({ message: 'Invalid refresh token' }, 401);
    }

    const newRefreshToken = await generateRefreshToken({
      userId: tokenRecord[0].userId,
      accountId: tokenRecord[0].accountId,
    });

    const accessToken = await generateAccessToken({
      userId: tokenRecord[0].userId,
      accountId: tokenRecord[0].accountId,
    });

    const expiresAt = addDays(new Date(), 30);

    await db.insert(refreshTokens).values({
      token: newRefreshToken,
      userId: tokenRecord[0].userId,
      accountId: tokenRecord[0].accountId,
      expiresAt,
    });

    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord[0].id));

    return c.json({
      message: 'Refresh token rotated successfully',
      data: {
        refreshToken: newRefreshToken,
        accessToken,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const me = async (c: Context) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      return c.json({ message: 'Unauthorized' }, 401);
    }

    const userRecord = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        website: users.website,
        email: accounts.email,
        accountType: accounts.accountType,
      })
      .from(users)
      .where(eq(users.id, authUser.userId))
      .innerJoin(
        accounts,
        and(eq(users.accountId, accounts.id), eq(accounts.id, authUser.accountId)),
      )
      .limit(1);

    if (!userRecord[0]) {
      return c.json({ message: 'User not found' }, 404);
    }

    return c.json({
      message: 'Authorized User information retrieved successfully',
      data: {
        id: userRecord[0].id,
        displayName: userRecord[0].displayName,
        userName: userRecord[0].userName,
        avatarUrl: userRecord[0].avatarUrl,
        bio: userRecord[0].bio,
        website: userRecord[0].website,
        email: userRecord[0].email,
        accountType: userRecord[0].accountType,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
};
