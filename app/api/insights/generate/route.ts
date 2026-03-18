import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';

function buildPrompt(type: string, item: any): string {
  let rawTime = String(item.timeInterval || item.time || '').trim();
  let time = rawTime;
  if (/^\d{1,2}:\d{1,2}$/.test(rawTime)) {
    const parts = rawTime.split(':');
    time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  const count = item.count || item.participants || 0;
  const percentageChange = item.percentageChange || item.percentage_change || item.change || 0;
  const transcriptContext = String(item.transcriptContext || '');
  const changeType = type === 'peak' ? 'increased' : 'decreased';

  if (!transcriptContext || transcriptContext.trim().length < 20) {
    return (
      'ROLE\nYou analyze webinar engagement changes.\n\n' +
      'TASK\nWrite EXACTLY ONE sentence.\n\n' +
      'HARD RULES\n- Transcript is insufficient to determine a cause.\n- Do NOT speculate.\n\n' +
      'OUTPUT\nReturn ONLY this sentence:\n' +
      `"At ${time}, engagement ${type === 'peak' ? 'increased' : 'decreased'} (${percentageChange}%, ${count} participants), but the transcript does not contain enough spoken context to identify a specific cause."`
    );
  }

  return (
    `ROLE\nYou analyze webinar engagement changes using spoken transcript context.\n\n` +
    `TASK\nWrite EXACTLY ONE professional sentence explaining why engagement ${changeType} at ${time}.\n\n` +
    `TRANSCRIPT CONTEXT (ONLY words spoken in the previous 10 minutes — this is the ONLY evidence you may use)\n"${transcriptContext}"\n\n` +
    `HARD RULES (MANDATORY)\n- Use ONLY the transcript words above as evidence.\n- Do NOT infer slides, polls, Q&A, or external events.\n- Do NOT infer tone unless explicitly visible in wording.\n- If no clear cause exists in text, say so.\n\n` +
    `OUTPUT KEY MUST BE EXACTLY: ${type}-${time}\n\n` +
    `Return STRICT JSON only in this format:\n{ "${type}-${time}": "sentence" }\n\n` +
    `DATA\nTime: ${time}\nParticipants: ${count}\nChange: ${percentageChange}%\n\n` +
    `Return ONLY the sentence.`
  );
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

    const results = await Promise.all(
      allItems.map(async (item) => {
        const type = item._type;
        const prompt = buildPrompt(type, item);

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
