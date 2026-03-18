export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const WORKFLOW_PATH = join(process.cwd(), 'lib', 'n8n-base-workflow.json');

async function requireAdmin(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  const payload = await verifyToken(cookie.value);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  try {
    const content = readFileSync(WORKFLOW_PATH, 'utf-8');
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

    writeFileSync(WORKFLOW_PATH, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const msg = e instanceof SyntaxError ? 'Invalid JSON: ' + e.message : e.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
