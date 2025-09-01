import { Hono } from 'hono';
import { stripeWebhook } from '../controller/webhook';

const webhookRouter = new Hono().post('/stripe', stripeWebhook);

export type AppType = typeof webhookRouter;
export default webhookRouter;
