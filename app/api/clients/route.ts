import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT DISTINCT client_name FROM zoom_meeting_analytics WHERE client_name IS NOT NULL ORDER BY client_name'
    );

    const clients = result.rows.map((row) => row.client_name);

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: `Database query failed: ${e.message}`,
    });
  }
}
