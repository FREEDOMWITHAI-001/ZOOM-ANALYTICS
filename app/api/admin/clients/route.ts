import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

// Ensure the role column exists (run once)
async function ensureSchema() {
  await pool.query(`
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    ALTER TABLE client_credentials ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);
}

// GET /api/admin/clients - list all clients with meeting counts
export async function GET() {
  try {
    await ensureSchema();

    const result = await pool.query(`
      SELECT
        c.client_name,
        c.role,
        c.is_active,
        c.created_at,
        COUNT(DISTINCT m.meeting_id) AS meeting_count
      FROM client_credentials c
      LEFT JOIN zoom_meeting_analytics m ON m.client_name = c.client_name
      GROUP BY c.client_name, c.role, c.is_active, c.created_at
      ORDER BY c.created_at DESC NULLS LAST
    `);

    return NextResponse.json({ success: true, clients: result.rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/clients - create new client
export async function POST(request: NextRequest) {
  try {
    await ensureSchema();

    const { client_name, password, role = 'user' } = await request.json();

    if (!client_name || !password) {
      return NextResponse.json(
        { error: 'client_name and password are required' },
        { status: 400 }
      );
    }

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'role must be user or admin' }, { status: 400 });
    }

    const existing = await pool.query(
      'SELECT 1 FROM client_credentials WHERE client_name = $1',
      [client_name]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Client already exists' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO client_credentials (client_name, password_hash, is_active, role, created_at)
       VALUES ($1, $2, true, $3, NOW())`,
      [client_name, password_hash, role]
    );

    return NextResponse.json({ success: true, client_name, role }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
