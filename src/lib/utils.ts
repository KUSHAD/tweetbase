import { generateTOTP, verifyTOTPWithGracePeriod } from '@oslojs/otp';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { EmailParams, Recipient, Sender } from 'mailersend';
import { Stripe } from 'stripe';
import z from 'zod/v4';
import { db } from '../db';
import { userSubscriptions } from '../db/schema';
import { mailerSend } from './email';
import { stripe } from './stripe';

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

export function getNotificationAction(type: string): string {
  switch (type) {
    case 'LIKE':
      return 'liked your tweet';
    case 'COMMENT':
      return 'commented on your tweet';
    case 'RETWEET':
      return 'retweeted your tweet';
    case 'QUOTE':
      return 'quoted your tweet';
    case 'FOLLOW':
      return 'followed you';
    default:
      return 'did something';
  }
}

export async function syncStripeDataToDB(customerId: string) {
  const [existing] = await db
    .select({
      userId: userSubscriptions.userId,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  const userId = existing?.userId ?? null;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  if (subscriptions.data.length === 0) {
    // No subscription found → mark as none
    const subData = {
      userId: userId, // if you always want a value
      stripeCustomerId: customerId,
      stripeSubscriptionId: 'none',
      status: 'none',
      currentPeriodStart: new Date(0),
      currentPeriodEnd: new Date(0),
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    };

    await db
      .insert(userSubscriptions)
      .values(subData)
      .onConflictDoUpdate({
        target: userSubscriptions.stripeCustomerId,
        set: {
          stripeSubscriptionId: 'none',
          status: 'none',
          currentPeriodStart: new Date(0),
          currentPeriodEnd: new Date(0),
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        },
      });

    return { status: 'none' };
  }

  const subscription = subscriptions.data[0];

  const subData = {
    userId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  await db
    .insert(userSubscriptions)
    .values(subData)
    .onConflictDoUpdate({
      target: userSubscriptions.stripeCustomerId,
      set: {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.items.data[0].current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

  return subData;
}

export const stripeAllowedEvents: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.upcoming',
  'invoice.marked_uncollectible',
  'invoice.payment_succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
];

export async function processStripeEvent(event: Stripe.Event) {
  // Skip processing if the event isn't one I'm tracking (list of all events below)
  if (!stripeAllowedEvents.includes(event.type)) return;

  // All the events I track have a customerId
  const { customer: customerId } = event?.data?.object as {
    customer: string; // Sadly TypeScript does not know this
  };

  // This helps make it typesafe and also lets me know if my assumption is wrong
  if (typeof customerId !== 'string') {
    throw new Error(`[STRIPE HOOK][CANCER] ID isn't string.\nEvent type: ${event.type}`);
  }

  return await syncStripeDataToDB(customerId);
}
