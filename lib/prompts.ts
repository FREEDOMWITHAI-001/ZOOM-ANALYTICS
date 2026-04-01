import pool from '@/lib/db';

// ─── Prompt Keys ─────────────────────────────────────────────────────────────

export const PROMPT_KEYS = {
  SEGMENT_ANALYSIS: 'segment_analysis',
  FULL_TRANSCRIPT: 'full_transcript',
  INSIGHT_WITH_CONTEXT: 'insight_with_context',
  INSIGHT_NO_CONTEXT: 'insight_no_context',
} as const;

export type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];

// ─── Template variable docs (shown in admin UI) ─────────────────────────────

export const PROMPT_META: Record<PromptKey, { label: string; description: string; variables: string[] }> = {
  [PROMPT_KEYS.SEGMENT_ANALYSIS]: {
    label: 'Segment Analysis',
    description: 'Evaluates a single transcript segment for content quality and engagement potential. Used by /api/ai/analyze-transcript.',
    variables: ['{{time}}', '{{participants}}', '{{transcript}}'],
  },
  [PROMPT_KEYS.FULL_TRANSCRIPT]: {
    label: 'Full Transcript Analysis',
    description: 'Analyzes the complete transcript and produces key insights + recommendations. Used by /api/ai/analyze-full-transcript.',
    variables: ['{{transcript}}'],
  },
  [PROMPT_KEYS.INSIGHT_WITH_CONTEXT]: {
    label: 'Insight (with transcript context)',
    description: 'Generates a single-sentence explanation for a peak/dropoff when transcript context is available. Used by /api/insights/generate.',
    variables: ['{{type}}', '{{changeType}}', '{{time}}', '{{count}}', '{{percentageChange}}', '{{transcriptContext}}'],
  },
  [PROMPT_KEYS.INSIGHT_NO_CONTEXT]: {
    label: 'Insight (no transcript context)',
    description: 'Fallback prompt when transcript context is insufficient. Used by /api/insights/generate.',
    variables: ['{{type}}', '{{time}}', '{{count}}', '{{percentageChange}}'],
  },
};

// ─── Default prompts (matching current hardcoded values) ─────────────────────

export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  [PROMPT_KEYS.SEGMENT_ANALYSIS]:
`You are evaluating a webinar transcript segment for content quality and engagement potential.

INPUT
Time: {{time}}
Participants: {{participants}}
Transcript: "{{transcript}}"

HARD RULES (ANTI-HALLUCINATION)
- Base everything ONLY on the words inside the transcript plus the provided time/participants.
- Do NOT invent what the speaker showed, what slides contained, or what happened outside this text.
- Do NOT mention technical/system/platform issues.

OUTPUT: Return STRICT JSON ONLY (no markdown, no extra text) with this schema:
{
  "time": "{{time}}",
  "content_quality": {
    "clarity_1to5": <1-5>,
    "structure_1to5": <1-5>,
    "specificity_1to5": <1-5>
  },
  "engagement_potential": {
    "energy_1to5": <1-5>,
    "interactivity_1to5": <1-5>,
    "actionability_1to5": <1-5>
  },
  "evidence_phrases": ["<up to 3 short exact phrases from the transcript, max 6 words each>"],
  "one_line_summary": "<one sentence>",
  "one_improvement": "<one specific improvement>"
}`,

  [PROMPT_KEYS.FULL_TRANSCRIPT]:
`ROLE
You are a senior webinar engagement analyst.

OBJECTIVE
Analyze the FULL transcript and produce time-based insights explaining:
1) What happened at specific moments
2) What could have been done differently at those moments

FULL TRANSCRIPT (ONLY SOURCE OF TRUTH)
"""
{{transcript}}
"""

HARD RULES (STRICT)
- Use ONLY the spoken words in the transcript.
- Do NOT assume slides, polls, Q&A, or visuals.
- Do NOT mention Zoom or technical issues.
- Do NOT generalize or give vague advice.
- Every point MUST reference a specific time (MM:SS).
- Every point MUST explain a clear cause and effect.

TASK 1 — KEY INSIGHTS
Write 2-4 bullet points.
Each bullet MUST follow this structure exactly:
"At <MM:SS>, engagement <increased/decreased> because <specific change in wording, tone, or topic>."

TASK 2 — RECOMMENDATIONS
Write 2-4 bullet points.
Each bullet MUST follow this structure exactly:
"Instead of <what happened at <MM:SS>>, the speaker should <specific alternative action>."

OUTPUT FORMAT (STRICT JSON ONLY)
{
  "key_insights": ["..."],
  "recommendations": ["..."]
}`,

  [PROMPT_KEYS.INSIGHT_WITH_CONTEXT]:
`ROLE
You analyze webinar engagement changes using spoken transcript context.

TASK
Write EXACTLY ONE professional sentence explaining why engagement {{changeType}} at {{time}}.

TRANSCRIPT CONTEXT (ONLY words spoken in the previous 10 minutes — this is the ONLY evidence you may use)
"{{transcriptContext}}"

HARD RULES (MANDATORY)
- Use ONLY the transcript words above as evidence.
- Do NOT infer slides, polls, Q&A, or external events.
- Do NOT infer tone unless explicitly visible in wording.
- If no clear cause exists in text, say so.

OUTPUT KEY MUST BE EXACTLY: {{type}}-{{time}}

Return STRICT JSON only in this format:
{ "{{type}}-{{time}}": "sentence" }

DATA
Time: {{time}}
Participants: {{count}}
Change: {{percentageChange}}%

Return ONLY the sentence.`,

  [PROMPT_KEYS.INSIGHT_NO_CONTEXT]:
`ROLE
You analyze webinar engagement changes.

TASK
Write EXACTLY ONE sentence.

HARD RULES
- Transcript is insufficient to determine a cause.
- Do NOT speculate.

OUTPUT
Return ONLY this sentence:
"At {{time}}, engagement {{changeType}} ({{percentageChange}}%, {{count}} participants), but the transcript does not contain enough spoken context to identify a specific cause."`,
};

// ─── DB helpers ──────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'ai_prompts';

/**
 * Load all prompts from DB, falling back to defaults for any missing keys.
 */
export async function loadPrompts(): Promise<Record<PromptKey, string>> {
  try {
    const result = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      [SETTINGS_KEY],
    );
    if (result.rows.length && result.rows[0].value) {
      const stored: Record<string, string> = JSON.parse(result.rows[0].value);
      // Merge: stored values take precedence, defaults fill gaps
      return {
        ...DEFAULT_PROMPTS,
        ...stored,
      };
    }
  } catch (e) {
    console.error('Failed to load prompts from DB, using defaults:', e);
  }
  return { ...DEFAULT_PROMPTS };
}

/**
 * Save prompts to DB. Only stores keys that differ from defaults.
 */
export async function savePrompts(prompts: Record<string, string>): Promise<void> {
  const json = JSON.stringify(prompts);
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [SETTINGS_KEY, json],
  );
}

/**
 * Replace template variables in a prompt string.
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
