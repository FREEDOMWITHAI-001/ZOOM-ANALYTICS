export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  const payload = await verifyToken(cookie.value);
  return payload?.role === 'admin';
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { provider, apiKey } = await request.json();
  if (!provider || !apiKey)
    return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 });

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 1 }),
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      return NextResponse.json({ valid: true, model: 'gpt-4o-mini' });
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      return NextResponse.json({ valid: true, model: 'claude-haiku-4-5-20251001' });
    }

    if (provider === 'gemini') {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 1 } }),
        }
      );
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ valid: false, error: data.error?.message || 'Invalid key' });
      return NextResponse.json({ valid: true, model: 'gemini-1.5-flash' });
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: e.message });
  }
}
