// Minimal fetch-based OpenAI client — no SDK dependency, matching how the
// rest of this codebase talks to external APIs (see NewsAPI in
// scripts/crawl.js). Models: gpt-5.5 (flagship reasoning) is used for both
// generation and fact-validation here since factual accuracy on
// autonomously-published content is exactly the "complex reasoning" case
// that warrants the smart tier over gpt-5.4-mini.

// gpt-5.5 is a reasoning-tier model and only supports the default
// temperature (1) — passing any other value is rejected outright, so it's
// omitted entirely rather than hardcoded to 1.
async function chatJson({ system, user, model = 'gpt-5.5', timeoutMs = 60000 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    // Long-form journalist drafts need more than 60s; ecosystem pieces also.
    signal: AbortSignal.timeout(Math.max(15000, Number(timeoutMs) || 60000)),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || `OpenAI request failed with status ${res.status}`);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI response had no message content.');

  try {
    return { data: JSON.parse(content), model: body.model, usage: body.usage };
  } catch {
    throw new Error('OpenAI response was not valid JSON.');
  }
}

module.exports = { chatJson };
