import { NextRequest, NextResponse } from 'next/server';
import { getCallerAIConfig, callAI } from '@/lib/ai-client';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { time, participants, transcript } = payload;

  if (!time || !transcript) {
    return NextResponse.json({ error: 'Missing required fields' });
  }

  const prompt =
    'You are evaluating a webinar transcript segment for content quality and engagement potential.\n\n' +
    'INPUT\n' +
    `Time: ${time}\n` +
    `Participants: ${participants}\n` +
    `Transcript: "${transcript}"\n\n` +
    'HARD RULES (ANTI-HALLUCINATION)\n' +
    '- Base everything ONLY on the words inside the transcript plus the provided time/participants.\n' +
    '- Do NOT invent what the speaker showed, what slides contained, or what happened outside this text.\n' +
    '- Do NOT mention technical/system/platform issues.\n\n' +
    'OUTPUT: Return STRICT JSON ONLY (no markdown, no extra text) with this schema:\n' +
    '{\n' +
    `  "time": "${time}",\n` +
    '  "content_quality": {\n' +
    '    "clarity_1to5": <1-5>,\n' +
    '    "structure_1to5": <1-5>,\n' +
    '    "specificity_1to5": <1-5>\n' +
    '  },\n' +
    '  "engagement_potential": {\n' +
    '    "energy_1to5": <1-5>,\n' +
    '    "interactivity_1to5": <1-5>,\n' +
    '    "actionability_1to5": <1-5>\n' +
    '  },\n' +
    '  "evidence_phrases": ["<up to 3 short exact phrases from the transcript, max 6 words each>"],\n' +
    '  "one_line_summary": "<one sentence>",\n' +
    '  "one_improvement": "<one specific improvement>"\n' +
    '}';

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
