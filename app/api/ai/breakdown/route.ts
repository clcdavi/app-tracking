import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { breakdownTaskWithGemini } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Iniciá sesión para usar el asistente IA.' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'La API Key de Gemini no está configurada en el servidor.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes : '';
    const area = typeof body.area === 'string' ? body.area : 'Personal';

    if (!title) {
      return NextResponse.json({ error: 'El título de la tarea es requerido.' }, { status: 400 });
    }

    const subtasks = await breakdownTaskWithGemini({
      apiKey,
      taskTitle: title,
      taskNotes: notes,
      area,
    });

    if (!subtasks || subtasks.length === 0) {
      return NextResponse.json(
        { error: 'No se pudo generar el desglose en este momento.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ subtasks });
  } catch (error) {
    console.error('Error in /api/ai/breakdown:', error);
    return NextResponse.json(
      { error: 'Error procesando la solicitud con IA.' },
      { status: 500 }
    );
  }
}
