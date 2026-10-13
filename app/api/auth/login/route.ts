import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email('Ingresá un correo electrónico válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export async function POST(req: Request) {
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
