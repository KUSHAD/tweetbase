import { ourFileRouter } from './uploadthing';

export type AuthUser = {
  userId: string;
  accountId: string;
};

export type OurFileRouter = typeof ourFileRouter;

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthUser;
  }
}
