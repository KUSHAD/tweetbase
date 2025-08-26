import { Context } from 'hono';
import { pusher } from '../lib/pusher';

export const pusherAuth = async (c: Context) => {
  const authUser = c.get('authUser');
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { socket_id, channel_name } = await c.req.parseBody<{
    socket_id: string;
    channel_name: string;
  }>();

  const authResponse = pusher.authorizeChannel(socket_id, channel_name, {
    user_id: authUser.userId,
  });

  return c.json(authResponse);
};
