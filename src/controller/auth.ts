import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { addDays, addMinutes } from 'date-fns';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { saasAccounts, saasSessions, saasUsers, saasVerificationTokens } from '../db/schema';

import {
  errorFormat,
  generateAccessToken,
  generateEmailVerificationToken,
  generateForgotPasswordToken,
  generatePasswordResetToken,
  generateRefreshToken,
  sendPasswordResetEmail as sendPasswordResetEmailUtils,
  sendVerificationEmail,
  verifyEmailVerificationToken,
} from '../lib/utils';

import { HTTPException } from 'hono/http-exception';
import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  resetPasswordSchema,
  signupSchema,
} from '../validators/auth';

export const signup = zValidator('json', signupSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { displayName, userName, email, password } = res.data;

  const [uExists] = await db.select().from(saasUsers).where(eq(saasUsers.userName, userName));
  if (uExists)
    throw new HTTPException(400, { message: 'Invalid Username', cause: 'Username exists' });

  const [eExists] = await db.select().from(saasAccounts).where(eq(saasAccounts.email, email));
  if (eExists) throw new HTTPException(400, { message: 'Invalid Email', cause: 'Email exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const [acc] = await db.insert(saasAccounts).values({ email, passwordHash }).returning();
  const [user] = await db
    .insert(saasUsers)
    .values({ accountId: acc.id, displayName, userName })
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

  const accessToken = await generateAccessToken({ userId: user.id, accountId: acc.id });
  const refreshToken = await generateRefreshToken({ userId: user.id, accountId: acc.id });

  await db.insert(saasSessions).values({
    refreshToken,
    userId: user.id,
    accountId: acc.id,
    ipAddress: c.req.header('x-forwarded-for') || '',
    userAgent: c.req.header('user-agent') || '',
    expiresAt: addDays(new Date(), 30),
  });

  const otp = await generateEmailVerificationToken();
  await db.insert(saasVerificationTokens).values({
    token: otp,
    userId: user.id,
    accountId: acc.id,
    expiresAt: addMinutes(new Date(), 60),
    tokenType: 'EMAIL_VERIFICATION',
  });

  await sendVerificationEmail({ email, name: displayName }, otp);

  return c.json({
    message: 'Signup complete, verify email.',
    data: { accessToken, refreshToken, user },
  });
});

export const login = zValidator('json', loginSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { identifier, password } = res.data;

  let user: any;
  let acc: any;

  const [uByName] = await db.select().from(saasUsers).where(eq(saasUsers.userName, identifier));
  if (uByName) {
    user = uByName;
    [acc] = await db.select().from(saasAccounts).where(eq(saasAccounts.id, user.accountId));
  } else {
    const [aByEmail] = await db
      .select()
      .from(saasAccounts)
      .where(eq(saasAccounts.email, identifier));
    if (!aByEmail)
      throw new HTTPException(401, { message: 'Invalid Credentials', cause: 'Account not found' });
    acc = aByEmail;
    [user] = await db
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
      .where(eq(saasUsers.accountId, acc.id));
  }

  const match = await bcrypt.compare(password, acc.passwordHash);
  if (!match)
    throw new HTTPException(401, { message: 'Invalid Credentials', cause: 'Password mismatch' });

  const accessToken = await generateAccessToken({ userId: user.id, accountId: acc.id });
  const refreshToken = await generateRefreshToken({ userId: user.id, accountId: acc.id });

  await db.insert(saasSessions).values({
    refreshToken,
    userId: user.id,
    accountId: acc.id,
    ipAddress: c.req.header('x-forwarded-for') || '',
    userAgent: c.req.header('user-agent') || '',
    expiresAt: addDays(new Date(), 30),
  });

  return c.json({
    message: 'Login success',
    data: { accessToken, refreshToken, user },
  });
});

export const logout = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { refreshToken } = res.data;
  await db.delete(saasSessions).where(eq(saasSessions.refreshToken, refreshToken));
  return c.json({ message: 'Logout done' });
});

export const verifyEmail = zValidator('json', emailVerificationSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { token } = res.data;
  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const [vt] = await db
    .select()
    .from(saasVerificationTokens)
    .where(
      and(
        eq(saasVerificationTokens.token, token),
        eq(saasVerificationTokens.userId, authUser.userId),
        eq(saasVerificationTokens.accountId, authUser.accountId),
        eq(saasVerificationTokens.tokenType, 'EMAIL_VERIFICATION'),
      ),
    );

  if (!vt)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token not found or expired' });
  const isValid = await verifyEmailVerificationToken(token);
  if (!isValid)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token verification failed' });

  await db
    .update(saasAccounts)
    .set({ emailVerified: true })
    .where(eq(saasAccounts.id, authUser.accountId));
  await db.delete(saasVerificationTokens).where(eq(saasVerificationTokens.id, vt.id));

  return c.json({ message: 'Email verified' });
});

export const sendPasswordResetEmail = zValidator('json', forgotPasswordSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { identifier } = res.data;
  let user: any, acc: any;

  const [u] = await db.select().from(saasUsers).where(eq(saasUsers.userName, identifier));
  if (u) {
    user = u;
    [acc] = await db.select().from(saasAccounts).where(eq(saasAccounts.id, user.accountId));
  } else {
    const [a] = await db.select().from(saasAccounts).where(eq(saasAccounts.email, identifier));
    if (!a)
      throw new HTTPException(401, { message: 'Invalid credentials', cause: 'Email not found' });
    acc = a;
    [user] = await db.select().from(saasUsers).where(eq(saasUsers.accountId, acc.id));
  }

  const otp = await generatePasswordResetToken();
  await db.insert(saasVerificationTokens).values({
    token: otp,
    userId: user.id,
    accountId: acc.id,
    expiresAt: addMinutes(new Date(), 60),
    tokenType: 'PASSWORD_RESET',
  });

  const resetToken = await generateForgotPasswordToken({ userId: user.id, accountId: acc.id });
  await sendPasswordResetEmailUtils({ email: acc.email, name: user.displayName }, otp);

  return c.json({ message: 'Check your inbox to reset password', data: { resetToken } });
});

export const resetPassword = zValidator('json', resetPasswordSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { token, password } = res.data;
  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const [vt] = await db
    .select()
    .from(saasVerificationTokens)
    .where(
      and(
        eq(saasVerificationTokens.token, token),
        eq(saasVerificationTokens.userId, authUser.userId),
        eq(saasVerificationTokens.accountId, authUser.accountId),
        eq(saasVerificationTokens.tokenType, 'PASSWORD_RESET'),
      ),
    );

  if (!vt)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token not found or expired' });

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(saasAccounts)
    .set({ passwordHash })
    .where(eq(saasAccounts.id, authUser.accountId));
  await db.delete(saasVerificationTokens).where(eq(saasVerificationTokens.id, vt.id));

  return c.json({ message: 'Password updated' });
});
