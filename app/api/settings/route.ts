import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { userSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema, normalizeSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para ver los ajustes.' }, { status: 401 });
  }

  try {
    const [row] = await db
      .select({ settings: userSettings.settings })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    const settings = normalizeSettings(row?.settings);
    return NextResponse.json({ settings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los ajustes.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para guardar los ajustes.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = settingsSchema.safeParse(body?.settings ?? body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Ajustes inválidos.' },
        { status: 400 }
      );
    }

    const settings = parsed.data;

    await db
      .insert(userSettings)
      .values({
        userId: user.id,
        settings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          settings,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ settings }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'No se pudieron guardar los ajustes.' },
      { status: 500 }
    );
  }
}
