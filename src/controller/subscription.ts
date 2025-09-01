import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { accounts, users, userSubscriptions } from '../db/schema';
import { stripe } from '../lib/stripe';
import { syncStripeDataToDB } from '../lib/utils';

export const generateCheckoutSession = async (c: Context) => {
  const authUser = c.get('authUser');

  const [subscriptionData] = await db
    .select({
      stripeCustomerId: userSubscriptions.stripeCustomerId,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, authUser.userId))
    .limit(1);

  let stripeCustomerId = subscriptionData?.stripeCustomerId;

  if (!subscriptionData) {
    const [customerDetails] = await db
      .select({
        email: accounts.email,
        displayName: users.displayName,
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.id, authUser.userId))
      .limit(1);

    const newCustomer = await stripe.customers.create({
      email: customerDetails.email,
      name: customerDetails.displayName,
      metadata: {
        userId: authUser.userId,
        accountId: authUser.accountId,
      },
    });

    stripeCustomerId = newCustomer.id;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'mobilepay'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
      },
    ],
    mode: 'subscription',
    success_url: `${c.req.header('origin')}/subscription/success`,
    cancel_url: `${c.req.header('origin')}/subscription/cancel`,
    customer: stripeCustomerId!,
  });

  return c.json({
    message: 'Checkout session created successfully',
    data: { sessionId: session.id, session: session.url },
  });
};

export const successPayment = async (c: Context) => {
  const authUser = c.get('authUser');
  const [subscriptionData] = await db
    .select({
      stripeCustomerId: userSubscriptions.stripeCustomerId,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, authUser.userId))
    .limit(1);

  if (!subscriptionData)
    throw new HTTPException(400, {
      message: 'Subscription not found',
      cause: 'Subscription not found in database',
    });

  const data = await syncStripeDataToDB(subscriptionData.stripeCustomerId);

  return c.json({ message: 'Subscription data synced successfully', data });
};

export const cancelPayment = async (c: Context) => {
  return c.json({ message: 'Payment flow canceled successfully' });
};

export const requestBillingPortal = async (c: Context) => {
  const authUser = c.get('authUser');
  const [subscriptionData] = await db
    .select({
      stripeCustomerId: userSubscriptions.stripeCustomerId,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, authUser.userId))
    .limit(1);

  if (!subscriptionData)
    throw new HTTPException(400, {
      message: 'Subscription not found',
      cause: 'Subscription not found in database',
    });

  const session = await stripe.billingPortal.sessions.create({
    customer: subscriptionData.stripeCustomerId,
    return_url: c.req.header('origin'),
  });

  return c.json({
    message: 'Billing portal session created successfully',
    data: { sessionId: session.id, session: session.url },
  });
};
