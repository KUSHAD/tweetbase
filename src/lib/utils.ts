import { SignJWT, jwtDecrypt } from 'jose';
import z from 'zod';

export function errorFormat(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      message: 'Validation failed',
      error: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  if (error instanceof Error) {
    return {
      message: 'Internal server error',
      error: error.message,
    };
  }
  return {
    message: 'An unknown error occurred',
    error: JSON.stringify(error),
  };
}

export async function generateAccessToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);
}

export async function generateRefreshToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function decryptAccessToken(token: string) {
  const secret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
  try {
    const { payload } = await jwtDecrypt(token, secret);
    return payload as Record<string, string>;
  } catch (error) {
    return null;
  }
}

export async function decryptRefreshToken(token: string) {
  const secret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);
  try {
    const { payload } = await jwtDecrypt(token, secret);
    return payload as Record<string, string>;
  } catch (error) {
    return null;
  }
}
