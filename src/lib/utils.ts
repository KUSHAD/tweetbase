import { generateTOTP, verifyTOTPWithGracePeriod } from '@oslojs/otp';
import { SignJWT, jwtVerify } from 'jose';
import { EmailParams, Recipient, Sender } from 'mailersend';
import z from 'zod/v4';
import { mailerSend } from './email';

export function errorFormat(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      message: 'Validation failed',
      error: error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  if (error instanceof Error) {
    return {
      message: 'Internal server error',
      error: error.message,
    };
  }
  return {
    message: 'An unknown error occurred',
    error: JSON.stringify(error),
  };
}

export async function generateAccessToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);
}

export async function generateRefreshToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function generateForgotPasswordToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(process.env.FORGOT_PASSWORD_TOKEN_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function decryptAccessToken(token: string) {
  const secret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, string>;
  } catch (error) {
    return null;
  }
}

export async function decryptRefreshToken(token: string) {
  const secret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, string>;
  } catch (error) {
    return null;
  }
}

export async function decryptForgotPasswordToken(token: string) {
  const secret = new TextEncoder().encode(process.env.FORGOT_PASSWORD_TOKEN_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, string>;
  } catch (error) {
    return null;
  }
}

export async function sendVerificationEmail(to: { email: string; name: string }, token: string) {
  const sender = new Sender(' MS_Z2So7q@test-3m5jgron9zzgdpyo.mlsender.net ', 'Tweetbase Auth');

  const recipient = [new Recipient(to.email, to.name)];

  const subject = `${token} - Email Verification - Tweetbase`;
  const body = `Your verification code is: ${token}. Please use this code to verify your email address.`;

  const emailParams = new EmailParams()
    .setFrom(sender)
    .setTo(recipient)
    .setSubject(subject)
    .setText(body);

  return await mailerSend.email.send(emailParams);
}

export async function sendPasswordResetEmail(to: { email: string; name: string }, token: string) {
  const sender = new Sender(' MS_Z2So7q@test-3m5jgron9zzgdpyo.mlsender.net ', 'Tweetbase Auth');
  const recipient = [new Recipient(to.email, to.name)];

  const subject = `${token} - Password Reset - Tweetbase`;
  const body = `Your password reset code is: ${token}. Please use this code to reset your password.`;

  const emailParams = new EmailParams()
    .setFrom(sender)
    .setTo(recipient)
    .setSubject(subject)
    .setText(body);

  return await mailerSend.email.send(emailParams);
}

export async function generateEmailVerificationToken() {
  const secret = new TextEncoder().encode(process.env.EMAIL_VERIFICATION_SECRET);
  return generateTOTP(secret, 60 * 60, 6);
}

export async function generatePasswordResetToken() {
  const secret = new TextEncoder().encode(process.env.FORGOT_PASSWORD_SECRET);
  return generateTOTP(secret, 60 * 60, 6);
}

export async function verifyEmailVerificationToken(token: string) {
  const secret = new TextEncoder().encode(process.env.EMAIL_VERIFICATION_SECRET);
  return verifyTOTPWithGracePeriod(secret, 60 * 60, 6, token, 60 * 10);
}

export async function verifyPasswordResetToken(token: string) {
  const secret = new TextEncoder().encode(process.env.FORGOT_PASSWORD_SECRET);
  return verifyTOTPWithGracePeriod(secret, 60 * 60, 6, token, 60 * 10);
}

export function getUploadthingFileKey(url: string) {
  return url.split('/f/')[1]!;
}
