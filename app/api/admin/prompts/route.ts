import { NextRequest, NextResponse } from 'next/server';
import { loadPrompts, savePrompts, DEFAULT_PROMPTS, PROMPT_META } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prompts = await loadPrompts();
    return NextResponse.json({
      success: true,
      prompts,
      defaults: DEFAULT_PROMPTS,
      meta: PROMPT_META,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompts } = body;

    if (!prompts || typeof prompts !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid prompts payload' }, { status: 400 });
    }

    await savePrompts(prompts);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
