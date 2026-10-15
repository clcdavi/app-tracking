import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  sendMorningBriefing,
  sendEveningReview,
  sendDeadlineReminder,
} from '@/lib/proactive-scheduler';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para probar notificaciones.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const type = body?.type;

    let success = false;
    let title = '';

    if (type === 'morning' || type === 'briefing') {
      title = 'Briefing matutino';
      success = await sendMorningBriefing(user.id, true);
    } else if (type === 'evening' || type === 'review') {
      title = 'Revisión vespertina';
      success = await sendEveningReview(user.id, true);
    } else if (type === 'deadline' || type === 'reminder') {
      title = 'Recordatorio de vencimientos';
      success = await sendDeadlineReminder(user.id, true);
    } else {
      return NextResponse.json({ error: 'Tipo de notificación no válido.' }, { status: 400 });
    }

    if (!success) {
      return NextResponse.json(
        { error: 'No se pudo enviar. Verificá que tu cuenta de Telegram esté vinculada desde Conectar otra app.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `${title} enviado con éxito a tu chat de Telegram.`,
    });
  } catch (err) {
    console.error('Error testing notification:', err);
    return NextResponse.json(
      { error: 'Error al enviar la notificación de prueba.' },
      { status: 500 }
    );
  }
}
