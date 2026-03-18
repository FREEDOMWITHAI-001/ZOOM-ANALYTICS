import pool from '@/lib/db';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { cookies } from 'next/headers';

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

export async function callAI(config: AIConfig, prompt: string): Promise<string> {
  const { provider, apiKey } = config;

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI error');
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Anthropic error');
    return data.content?.[0]?.text || '';
  }

  if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}

export async function getCallerAIConfig(): Promise<AIConfig | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;

    const result = await pool.query(
      'SELECT ai_provider, ai_api_key FROM client_credentials WHERE client_name = $1',
      [payload.client_name]
    );
    if (!result.rows.length || !result.rows[0].ai_api_key) return null;
    return {
      provider: (result.rows[0].ai_provider as AIProvider) || 'openai',
      apiKey: result.rows[0].ai_api_key,
    };
  } catch {
    return null;
  }
}
