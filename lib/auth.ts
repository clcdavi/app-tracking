import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

export const SESSION_COOKIE_NAME = 'enfoco_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Pre-computed bcrypt cost-12 hash used for constant-time comparisons when a user is not found
export const DUMMY_PASSWORD_HASH = '$2a$12$e80MvQkKjJbX6Rz/9fBHeuJvU1w2KqE9eFm9B8Y6vH5jJ2K4l.2.a';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  // Opportunistic cleanup of expired sessions
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  } catch (e) {
    console.error('Opportunistic session cleanup error:', e);
  }

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  // Only set 'secure: true' if connection is HTTPS or COOKIE_SECURE=true.
  // Over plain HTTP (e.g. accessing via http://IP:3000), browsers drop Secure cookies.
  let isSecure = process.env.COOKIE_SECURE === 'true';
  try {
    const headerList = await headers();
    const proto = headerList.get('x-forwarded-proto');
    if (proto === 'https') {
      isSecure = true;
    }
  } catch {
    // fallback
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.id, token));
    } catch (e) {
      console.error('Error deleting session:', e);
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const now = new Date();
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
      .limit(1);

    if (!result.length) {
      return null;
    }

    const { id, email, displayName } = result[0];
    return { id, email, displayName };
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return null;
  }
}
