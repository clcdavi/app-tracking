import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, DUMMY_PASSWORD_HASH } from '@/lib/auth';
import { checkRateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ingresá un correo electrónico válido.')
    .max(255, 'El correo no puede superar 255 caracteres.'),
  password: z
    .string()
    .min(1, 'Ingresá tu contraseña.')
    .max(72, 'La contraseña no puede superar 72 caracteres.'),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rateLimitKey = `login:${ip}`;

  // Rate limiting: 5 attempts per 60 seconds
  const rate = checkRateLimit(rateLimitKey, 5, 60);
  if (!rate.success) {
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Por favor, esperá ${rate.resetSeconds} segundos.` },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.resetSeconds) },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos incompletos.' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!userList.length) {
      // Execute dummy password verification to eliminate timing side-channel
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 }
      );
    }

    const user = userList[0];
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
        { status: 401 }
      );
    }

    // Reset rate limiter on successful authentication
    resetRateLimit(rateLimitKey);

    await createSession(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar el inicio de sesión.' },
      { status: 500 }
    );
  }
}
