import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, ver: tokenVersion },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
  );
}

export interface TokenPayload {
  userId: string;
  tokenVersion: number;
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid token payload');
  return { userId: payload.sub, tokenVersion: payload.ver ?? 0 };
}
