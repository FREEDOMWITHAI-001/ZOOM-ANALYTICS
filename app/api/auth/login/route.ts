import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { signToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { client_name, password } = await request.json();

    if (!client_name || !password) {
      return NextResponse.json(
        { error: 'Client name and password are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'SELECT password_hash FROM client_credentials WHERE client_name = $1 AND is_active = true',
      [client_name]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, result.rows[0].password_hash);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await signToken(client_name);

    const response = NextResponse.json({
      success: true,
      client_name,
    });

    const isSecure = request.headers.get('x-forwarded-proto') === 'https' ||
      request.nextUrl.protocol === 'https:';

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: `Login failed: ${e.message}` },
      { status: 500 }
    );
  }
}
