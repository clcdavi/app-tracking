import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sameOrigin } from '@/lib/integration-keys';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const [row] = await db
      .select({
        telegramChatId: users.telegramChatId,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
    const isConnected = Boolean(row?.telegramChatId);

    return NextResponse.json({
      connected: isConnected,
      botUsername,
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    });
  } catch (err) {
    console.error('Error fetching Telegram status:', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  try {
    // Generate secure 16-byte hex token
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    await db
      .update(users)
      .set({
        telegramConnectToken: token,
        telegramConnectExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'EnfocoBot';
    const link = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      token,
      link,
      botUsername,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error('Error generating Telegram connect token:', err);
    return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
  }

  try {
    await db
      .update(users)
      .set({
        telegramChatId: null,
        telegramConnectToken: null,
        telegramConnectExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true, connected: false });
  } catch (err) {
    console.error('Error unlinking Telegram:', err);
    return NextResponse.json({ error: 'Error al desconectar Telegram' }, { status: 500 });
  }
}
