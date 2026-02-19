import { NextRequest, NextResponse } from 'next/server';

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
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const res = await openaiRes.json();
    const choices = res.choices;

    if (!choices || choices.length === 0) {
      return NextResponse.json({});
    }

    const content = choices[0].message.content;

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: 'Invalid AI response format' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `OpenAI request failed: ${e.message}` });
  }
}
