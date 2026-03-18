export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import pool from '@/lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function requireAdmin(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  const payload = await verifyToken(cookie.value);
  return payload?.role === 'admin';
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getWorkflowContent(): Promise<string> {
  await ensureTable();
  // Check DB first (edits saved there)
  const result = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'workflow_template'"
  );
  if (result.rows.length > 0) return result.rows[0].value;
  // Fall back to bundled file
  const filePath = join(process.cwd(), 'lib', 'n8n-base-workflow.json');
  return readFileSync(filePath, 'utf-8');
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const content = await getWorkflowContent();
    return NextResponse.json({ content });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!await requireAdmin(request))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const { content } = await request.json();
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    // Validate JSON before saving
    JSON.parse(content);

    await ensureTable();
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('workflow_template', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [content]
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const msg = e instanceof SyntaxError ? 'Invalid JSON: ' + e.message : e.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
