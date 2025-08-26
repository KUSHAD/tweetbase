import { Hono } from 'hono';
import { getUserNotifications, markAsRead } from '../controller/notifications';
import { authMiddleware } from '../middleware/auth';

const notificationsRouter = new Hono();

notificationsRouter.all('/', authMiddleware).patch(markAsRead).get(getUserNotifications);

export type AppType = typeof notificationsRouter;
export default notificationsRouter;
