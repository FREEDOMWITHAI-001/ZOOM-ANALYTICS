export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { signToken, verifyToken, COOKIE_NAME } from '@/lib/auth';

// POST /api/admin/impersonate — admin assumes a user's session
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is an admin
    const cookie = request.cookies.get(COOKIE_NAME);
    if (!cookie) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyToken(cookie.value);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { client_name } = await request.json();
    if (!client_name) {
      return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
    }

    // Verify the target client exists
    const result = await pool.query(
      'SELECT client_name, role FROM client_credentials WHERE client_name = $1 AND is_active = true',
      [client_name]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Client not found or inactive' }, { status: 404 });
    }

    const targetRole = result.rows[0].role || 'user';

    // Issue a JWT for the target client
    const token = await signToken(client_name, targetRole);

    const response = NextResponse.json({ success: true, client_name, role: targetRole });

    const isSecure =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.nextUrl.protocol === 'https:';

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
