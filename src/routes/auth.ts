import { Hono } from 'hono';
import { signup } from '../controller/auth';

const authRouter = new Hono();

authRouter.post('/signup', signup);

export default authRouter;
