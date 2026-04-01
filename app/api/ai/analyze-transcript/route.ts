import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';
import { loadPrompts, renderPrompt, PROMPT_KEYS } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { time, participants, transcript } = payload;

  if (!time || !transcript) {
    return NextResponse.json({ error: 'Missing required fields' });
  }

  const prompts = await loadPrompts();
  const prompt = renderPrompt(prompts[PROMPT_KEYS.SEGMENT_ANALYSIS], {
    time,
    participants: String(participants ?? ''),
    transcript,
  });

  try {
    const aiConfig = await getCallerAIConfig();
    if (!aiConfig) {
      return NextResponse.json({ error: 'AI provider not configured for this account' }, { status: 400 });
    }
    const content = await callAI(aiConfig, prompt);

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: 'Invalid AI response format' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `AI request failed: ${e.message}` });
  }
}
