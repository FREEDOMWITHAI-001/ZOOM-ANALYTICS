import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';
import { loadPrompts, renderPrompt, PROMPT_KEYS } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transcript } = body;

  if (!transcript || transcript.trim().length < 100) {
    return NextResponse.json({
      success: false,
      error: 'Full transcript is required',
    });
  }

  const prompts = await loadPrompts();
  const prompt = renderPrompt(prompts[PROMPT_KEYS.FULL_TRANSCRIPT], {
    transcript,
  });

  try {
    const aiConfig = await getCallerAIConfig();
    if (!aiConfig) {
      return NextResponse.json({ success: false, error: 'AI provider not configured for this account' }, { status: 400 });
    }
    const content = await callAI(aiConfig, prompt);

    try {
      const aiResult = JSON.parse(content);
      return NextResponse.json(aiResult);
    } catch {
      return NextResponse.json({ success: false, error: 'AI response parsing failed' });
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: `AI request failed: ${e.message}` });
  }
}
