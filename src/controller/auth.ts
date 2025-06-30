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

import {
  emailVerificationSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  resetPasswordSchema,
  signupSchema,
} from '../validators/auth';

export const signup = zValidator('json', signupSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  const { displayName, userName, email, password } = res.data;

  try {
    const [uExists] = await db.select().from(saasUsers).where(eq(saasUsers.userName, userName));
    if (uExists) return c.json({ message: 'Username exists' }, 400);

    const [eExists] = await db.select().from(saasAccounts).where(eq(saasAccounts.email, email));
    if (eExists) return c.json({ message: 'Email exists' }, 400);

    const passwordHash = await bcrypt.hash(password, 10);
    const [acc] = await db.insert(saasAccounts).values({ email, passwordHash }).returning();
    const [user] = await db
      .insert(saasUsers)
      .values({ accountId: acc.id, displayName, userName })
      .returning();

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
      data: {
        accessToken,
        refreshToken,
        user: {
          ...user,
          email: acc.email,
          accountType: acc.accountType,
        },
      },
    });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const login = zValidator('json', loginSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  const { identifier, password } = res.data;

  try {
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
      if (!aByEmail) return c.json({ message: 'Invalid credentials' }, 401);
      acc = aByEmail;
      [user] = await db.select().from(saasUsers).where(eq(saasUsers.accountId, acc.id));
    }

    const match = await bcrypt.compare(password, acc.passwordHash);
    if (!match) return c.json({ message: 'Invalid credentials' }, 401);

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
      data: {
        accessToken,
        refreshToken,
        user: {
          ...user,
          email: acc.email,
          accountType: acc.accountType,
        },
      },
    });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const logout = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { refreshToken } = res.data;

  try {
    await db.delete(saasSessions).where(eq(saasSessions.refreshToken, refreshToken));
    return c.json({ message: 'Logout done' });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const verifyEmail = zValidator('json', emailVerificationSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { token } = res.data;

  const authUser = c.get('authUser');
  if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

  try {
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

    if (!vt) return c.json({ message: 'Invalid or expired token' }, 400);

    const isValid = await verifyEmailVerificationToken(token);
    if (!isValid) return c.json({ message: 'Invalid or expired token' }, 400);

    await db
      .update(saasAccounts)
      .set({ emailVerified: true })
      .where(eq(saasAccounts.id, authUser.accountId));

    await db.delete(saasVerificationTokens).where(eq(saasVerificationTokens.id, vt.id));

    return c.json({ message: 'Email verified' });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const sendPasswordResetEmail = zValidator('json', forgotPasswordSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { identifier } = res.data;

  try {
    let user: any, acc: any;

    const [u] = await db.select().from(saasUsers).where(eq(saasUsers.userName, identifier));
    if (u) {
      user = u;
      [acc] = await db.select().from(saasAccounts).where(eq(saasAccounts.id, user.accountId));
    } else {
      const [a] = await db.select().from(saasAccounts).where(eq(saasAccounts.email, identifier));
      if (!a) return c.json({ message: 'Invalid credentials' }, 401);
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

    const resetToken = await generateForgotPasswordToken({
      userId: u.id,
      accountId: u.accountId,
    });

    await sendPasswordResetEmailUtils({ email: acc.email, name: user.displayName }, otp);
    return c.json({ message: 'Check your inbox to reset password', resetToken });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const resetPassword = zValidator('json', resetPasswordSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { token, password } = res.data;
  const authUser = c.get('authUser');
  if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

  try {
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

    if (!vt) return c.json({ message: 'Invalid or expired reset token' }, 400);

    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(saasAccounts)
      .set({ passwordHash })
      .where(eq(saasAccounts.id, authUser.accountId));

    await db.delete(saasVerificationTokens).where(eq(saasVerificationTokens.id, vt.id));

    return c.json({ message: 'Password updated' });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});
