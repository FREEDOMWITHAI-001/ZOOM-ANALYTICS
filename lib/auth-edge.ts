import { jwtVerify } from 'jose';

export const COOKIE_NAME = 'zoom-auth-token';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
};

export async function verifyToken(
  token: string
): Promise<{ client_name: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { client_name: string };
  } catch {
    return null;
  }
}
