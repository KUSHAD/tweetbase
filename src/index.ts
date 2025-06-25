import 'dotenv/config';
import { Hono } from 'hono';
import router from './routes';

const app = new Hono();

app.route('/', router);

export default app;
