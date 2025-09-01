import { Hono } from 'hono';
import {
  cancelPayment,
  generateCheckoutSession,
  requestBillingPortal,
  successPayment,
} from '../controller/subscription';
import { authMiddleware } from '../middleware/auth';

export const subscriptionRouter = new Hono()
  .all(authMiddleware)
  .post('/checkout', generateCheckoutSession)
  .get('/success', successPayment)
  .get('/cancel', cancelPayment)
  .post('/billing-portal', requestBillingPortal);

export type AppType = typeof subscriptionRouter;
export default subscriptionRouter;
