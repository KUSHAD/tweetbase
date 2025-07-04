export type AuthUser = {
  userId: string;
  accountId: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    authUser: AuthUser;
  }
}
