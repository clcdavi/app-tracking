import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  email: z.string().trim().email('Ingresá un correo electrónico válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  displayName: z.string().trim().min(1, 'Ingresá tu nombre.').max(120),
});

export async function POST(req: Request) {
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
