import { Context } from 'hono';
import { stripe } from '../lib/stripe';
import { processStripeEvent } from '../lib/utils';

export const stripeWebhook = async (c: Context) => {
  const body = await c.req.raw.clone().text();
  const signature = c.req.header('Stripe-Signature');

  if (!signature) return c.json({ message: 'No signature' }, 400);

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    console.log('[STRIPE HOOK] Event:', event.type);

    c.executionCtx.waitUntil(
      (async () => {
        try {
          await processStripeEvent(event);
        } catch (err) {
          console.error('[STRIPE HOOK] Error in background processing:', err);
        }
      })(),
    );

    return c.json({ received: true });
  } catch (error) {
    console.error('[STRIPE HOOK] Error verifying event', error);
    return c.json({ received: false }, 400);
  }
};
