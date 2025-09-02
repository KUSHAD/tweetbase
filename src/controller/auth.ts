import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { addDays, addMinutes } from 'date-fns';
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { accounts, sessions, users, verificationTokens } from '../db/schema';

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

import { getGeo } from 'hono-geo-middleware';
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

  const [uExists] = await db.select().from(users).where(eq(users.userName, userName));
  if (uExists)
    throw new HTTPException(400, { message: 'Invalid Username', cause: 'Username exists' });

  const [eExists] = await db.select().from(accounts).where(eq(accounts.email, email));
  if (eExists) throw new HTTPException(400, { message: 'Invalid Email', cause: 'Email exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const [acc] = await db.insert(accounts).values({ email, passwordHash }).returning();
  const [user] = await db
    .insert(users)
    .values({ accountId: acc.id, displayName, userName })
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

  const accessToken = await generateAccessToken({ userId: user.id, accountId: acc.id });
  const refreshToken = await generateRefreshToken({ userId: user.id, accountId: acc.id });

  const geoData = getGeo(c);

  await db.insert(sessions).values({
    refreshToken,
    userId: user.id,
    accountId: acc.id,
    ipAddress: geoData.ip || '',
    userAgent: c.req.header('user-agent') || '',
    city: geoData.city || '',
    country: geoData.country || '',
    location: {
      x: geoData.latitude || 0,
      y: geoData.longitude || 0,
    },
    expiresAt: addDays(new Date(), 30),
  });

  const otp = await generateEmailVerificationToken();
  await db.insert(verificationTokens).values({
    token: otp,
    userId: user.id,
    accountId: acc.id,
    expiresAt: addMinutes(new Date(), 60),
    tokenType: 'EMAIL_VERIFICATION',
  });

  c.executionCtx.waitUntil(
    (async () => {
      await sendVerificationEmail({ email, name: displayName }, otp);
    })(),
  );

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

  const [uByName] = await db.select().from(users).where(eq(users.userName, identifier));
  if (uByName) {
    user = uByName;
    [acc] = await db.select().from(accounts).where(eq(accounts.id, user.accountId));
  } else {
    const [aByEmail] = await db.select().from(accounts).where(eq(accounts.email, identifier));
    if (!aByEmail)
      throw new HTTPException(401, { message: 'Invalid Credentials', cause: 'Account not found' });
    acc = aByEmail;
    [user] = await db
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
      .where(eq(users.accountId, acc.id));
  }

  const match = await bcrypt.compare(password, acc.passwordHash);
  if (!match)
    throw new HTTPException(401, { message: 'Invalid Credentials', cause: 'Password mismatch' });

  const accessToken = await generateAccessToken({ userId: user.id, accountId: acc.id });
  const refreshToken = await generateRefreshToken({ userId: user.id, accountId: acc.id });

  const geoData = getGeo(c);

  await db.insert(sessions).values({
    refreshToken,
    userId: user.id,
    accountId: acc.id,
    ipAddress: geoData.ip || '',
    userAgent: c.req.header('user-agent') || '',
    city: geoData.city || '',
    country: geoData.country || '',
    location: {
      x: geoData.latitude || 0,
      y: geoData.longitude || 0,
    },
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
  await db.delete(sessions).where(eq(sessions.refreshToken, refreshToken));
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
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.userId, authUser.userId),
        eq(verificationTokens.accountId, authUser.accountId),
        eq(verificationTokens.tokenType, 'EMAIL_VERIFICATION'),
      ),
    );

  if (!vt)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token not found or expired' });
  const isValid = await verifyEmailVerificationToken(token);
  if (!isValid)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token verification failed' });

  await db.update(accounts).set({ emailVerified: true }).where(eq(accounts.id, authUser.accountId));
  await db.delete(verificationTokens).where(eq(verificationTokens.id, vt.id));

  return c.json({ message: 'Email verified' });
});

export const sendPasswordResetEmail = zValidator('json', forgotPasswordSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { identifier } = res.data;
  let user: any, acc: any;

  const [u] = await db.select().from(users).where(eq(users.userName, identifier));
  if (u) {
    user = u;
    [acc] = await db.select().from(accounts).where(eq(accounts.id, user.accountId));
  } else {
    const [a] = await db.select().from(accounts).where(eq(accounts.email, identifier));
    if (!a)
      throw new HTTPException(401, { message: 'Invalid credentials', cause: 'Email not found' });
    acc = a;
    [user] = await db.select().from(users).where(eq(users.accountId, acc.id));
  }

  const otp = await generatePasswordResetToken();
  await db.insert(verificationTokens).values({
    token: otp,
    userId: user.id,
    accountId: acc.id,
    expiresAt: addMinutes(new Date(), 60),
    tokenType: 'PASSWORD_RESET',
  });

  const resetToken = await generateForgotPasswordToken({ userId: user.id, accountId: acc.id });

  c.executionCtx.waitUntil(
    (async () => {
      await sendPasswordResetEmailUtils({ email: acc.email, name: user.displayName }, otp);
    })(),
  );

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
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.userId, authUser.userId),
        eq(verificationTokens.accountId, authUser.accountId),
        eq(verificationTokens.tokenType, 'PASSWORD_RESET'),
      ),
    );

  if (!vt)
    throw new HTTPException(400, { message: 'Invalid token', cause: 'Token not found or expired' });

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(accounts).set({ passwordHash }).where(eq(accounts.id, authUser.accountId));
  await db.delete(verificationTokens).where(eq(verificationTokens.id, vt.id));

  return c.json({ message: 'Password updated' });
});
