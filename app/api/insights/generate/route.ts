import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';
import { loadPrompts, renderPrompt, PROMPT_KEYS } from '@/lib/prompts';

function buildPrompt(
  type: string,
  item: any,
  promptWithContext: string,
  promptNoContext: string,
): string {
  let rawTime = String(item.timeInterval || item.time || '').trim();
  let time = rawTime;
  if (/^\d{1,2}:\d{1,2}$/.test(rawTime)) {
    const parts = rawTime.split(':');
    time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  const count = String(item.count || item.participants || 0);
  const percentageChange = String(item.percentageChange || item.percentage_change || item.change || 0);
  const transcriptContext = String(item.transcriptContext || '');
  const changeType = type === 'peak' ? 'increased' : 'decreased';

  if (!transcriptContext || transcriptContext.trim().length < 20) {
    return renderPrompt(promptNoContext, {
      type,
      time,
      count,
      percentageChange,
      changeType,
    });
  }

  return renderPrompt(promptWithContext, {
    type,
    time,
    count,
    percentageChange,
    changeType,
    transcriptContext,
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const peaks = payload.peaks || [];
  const dropoffs = payload.dropoffs || [];

  const allItems = [
    ...peaks.map((item: any) => ({ ...item, _type: 'peak' })),
    ...dropoffs.map((item: any) => ({ ...item, _type: 'dropoff' })),
  ];

  try {
    const aiConfig = await getCallerAIConfig();
    if (!aiConfig) {
      return NextResponse.json({ error: 'AI provider not configured for this account' }, { status: 400 });
    }

    const prompts = await loadPrompts();
    const promptWithContext = prompts[PROMPT_KEYS.INSIGHT_WITH_CONTEXT];
    const promptNoContext = prompts[PROMPT_KEYS.INSIGHT_NO_CONTEXT];

    const results = await Promise.all(
      allItems.map(async (item) => {
        const type = item._type;
        const prompt = buildPrompt(type, item, promptWithContext, promptNoContext);

        try {
          let content = await callAI(aiConfig, prompt);
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          try {
            return JSON.parse(content);
          } catch {
            console.log('AI JSON parse failed for item:', item);
            return {};
          }
        } catch {
          return {};
        }
      })
    );

    // Merge all results into a single object
    const merged: Record<string, string> = {};
    for (const result of results) {
      Object.assign(merged, result);
    }

    return NextResponse.json(merged);
  } catch (e: any) {
    return NextResponse.json({ error: `Failed to generate insights: ${e.message}` });
  }
}
