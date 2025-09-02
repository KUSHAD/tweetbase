import { Hono } from 'hono';
import {
  cancelPayment,
  generateCheckoutSession,
  requestBillingPortal,
  successPayment,
} from '../controller/subscription';
import { authMiddleware } from '../middleware/auth';

export const subscriptionRouter = new Hono()
  .post('/checkout', authMiddleware, generateCheckoutSession)
  .get('/success', successPayment)
  .get('/cancel', cancelPayment)
  .post('/billing-portal', authMiddleware, requestBillingPortal);

export type AppType = typeof subscriptionRouter;
export default subscriptionRouter;
