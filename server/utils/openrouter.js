// OpenRouter client — free model: google/gemini-2.0-flash-exp:free

const OR_URL   = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL    = 'google/gemini-2.0-flash-exp:free';

/**
 * Send a chat completion request to OpenRouter.
 * @param {Array<{role,content}>} messages
 * @param {{ temperature?, max_tokens? }} opts
 * @returns {Promise<string>} assistant message content
 */
export async function chat(messages, opts = {}) {
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://narrativeauditor.onrender.com',
      'X-Title':       'NarrativeAuditor',
    },
    body: JSON.stringify({
      model:       MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens:  opts.max_tokens  ?? 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter error ${res.status}: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Parse JSON from model response — strips markdown code fences if present.
 */
export function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(cleaned);
}
