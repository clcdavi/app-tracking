import { NextResponse } from 'next/server';
import { pool } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }

    return NextResponse.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    console.error('Healthcheck failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: (error as Error).message,
      },
      { status: 503 }
    );
  }
}
