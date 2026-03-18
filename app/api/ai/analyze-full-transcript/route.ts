import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transcript } = body;

  if (!transcript || transcript.trim().length < 100) {
    return NextResponse.json({
      success: false,
      error: 'Full transcript is required',
    });
  }

  const prompt =
    'ROLE\nYou are a senior webinar engagement analyst.\n\n' +
    'OBJECTIVE\nAnalyze the FULL transcript and produce time-based insights explaining:\n' +
    '1) What happened at specific moments\n' +
    '2) What could have been done differently at those moments\n\n' +
    'FULL TRANSCRIPT (ONLY SOURCE OF TRUTH)\n"""\n' +
    transcript +
    '\n"""\n\n' +
    'HARD RULES (STRICT)\n' +
    '- Use ONLY the spoken words in the transcript.\n' +
    '- Do NOT assume slides, polls, Q&A, or visuals.\n' +
    '- Do NOT mention Zoom or technical issues.\n' +
    '- Do NOT generalize or give vague advice.\n' +
    '- Every point MUST reference a specific time (MM:SS).\n' +
    '- Every point MUST explain a clear cause and effect.\n\n' +
    'TASK 1 — KEY INSIGHTS\nWrite 2-4 bullet points.\n' +
    'Each bullet MUST follow this structure exactly:\n' +
    '"At <MM:SS>, engagement <increased/decreased> because <specific change in wording, tone, or topic>."\n\n' +
    'TASK 2 — RECOMMENDATIONS\nWrite 2-4 bullet points.\n' +
    'Each bullet MUST follow this structure exactly:\n' +
    '"Instead of <what happened at <MM:SS>>, the speaker should <specific alternative action>."\n\n' +
    'OUTPUT FORMAT (STRICT JSON ONLY)\n{\n  "key_insights": ["..."],\n  "recommendations": ["..."]\n}';

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
