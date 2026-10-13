import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, createSession } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Ingresá un correo electrónico válido.')
    .max(255, 'El correo no puede superar 255 caracteres.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'La contraseña no puede superar 72 caracteres.'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Ingresá tu nombre.')
    .max(120, 'El nombre no puede superar 120 caracteres.'),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rateLimitKey = `register:${ip}`;

  // Rate limiting: 5 registrations per 15 minutes (900 seconds)
  const rate = checkRateLimit(rateLimitKey, 5, 900);
  if (!rate.success) {
    return NextResponse.json(
      { error: `Demasiados intentos de registro. Por favor, esperá ${rate.resetSeconds} segundos.` },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.resetSeconds) },
      }
    );
  }

  try {
    // Check if registration is allowed or if initial user setup
    const allowRegistration = process.env.ALLOW_REGISTRATION !== 'false';
    const userCountResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(userCountResult[0]?.count || 0);

    // If registration is closed and there is already at least one user registered, reject
    if (!allowRegistration && totalUsers > 0) {
      return NextResponse.json(
        { error: 'El registro público está deshabilitado en este servidor.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Datos incompletos.' },
        { status: 400 }
      );
    }

    const { email, password, displayName } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta registrada con este correo.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    await createSession(newUser.id);

    return NextResponse.json({
      user: newUser,
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al crear la cuenta.' },
      { status: 500 }
    );
  }
}
