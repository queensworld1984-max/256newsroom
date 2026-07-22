const express = require('express');
const { requireAuth, requireRole } = require('../auth');
const { chatJson } = require('../openaiClient');

const router = express.Router();

router.use(
  requireAuth,
  requireRole(
    'independent_journalist',
    'publisher_owner',
    'publisher_editor',
    'journalist',
    'super_admin',
    'newsroom_admin',
  ),
);

/** Allowed journalist draft lengths (words). Custom values are clamped. */
const WORD_COUNT_PRESETS = {
  short: 400,
  medium: 700,
  long: 1100,
  feature: 1500,
};

const MIN_WORDS = 300;
const MAX_WORDS = 2500;

function resolveTargetWords(body) {
  if (body.wordCountPreset && WORD_COUNT_PRESETS[body.wordCountPreset]) {
    return WORD_COUNT_PRESETS[body.wordCountPreset];
  }
  const raw = Number(body.wordCount || body.targetWords || body.words);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(MIN_WORDS, Math.min(MAX_WORDS, Math.round(raw)));
  }
  // Default to a substantial medium-long piece — not a stub.
  return WORD_COUNT_PRESETS.long;
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

// POST /api/ai/draft-story
// Body: { notes, wordCount? | wordCountPreset?, title?, category?, district?, tone? }
router.post('/draft-story', async (req, res, next) => {
  try {
    const notes = String(req.body.notes || '').trim();
    if (notes.length < 20) {
      return res.status(400).json({ error: 'Provide at least 20 characters of notes or facts for the AI drafter.' });
    }
    if (notes.length > 12000) {
      return res.status(400).json({ error: 'Notes are too long (max 12000 characters).' });
    }

    const targetWords = resolveTargetWords(req.body);
    const minBody = Math.max(MIN_WORDS, Math.round(targetWords * 0.9));
    const maxBody = Math.round(targetWords * 1.15);

    const titleHint = req.body.title ? String(req.body.title).trim().slice(0, 300) : '';
    const category = req.body.category ? String(req.body.category).trim().slice(0, 80) : '';
    const district = req.body.district ? String(req.body.district).trim().slice(0, 80) : '';
    const tone = req.body.tone ? String(req.body.tone).trim().slice(0, 40) : 'straight news';

    const system = `You are a senior news editor and rewrite desk for 256 Newsroom (Uganda's Digital News Infrastructure).
Your job is to turn reporter notes into a complete, intelligent, publishable news article — not a thin stub.

Length (mandatory):
- Body must be approximately ${targetWords} words (acceptable range ${minBody}–${maxBody} words).
- Count words carefully. Do not stop early. Do not pad with empty repetition.
- If notes are sparse, expand with careful context, structure, implications, and what is known vs unknown — WITHOUT inventing new hard facts, names, figures, quotes, or events.

Intelligence & craft:
- Write like a competent wire + features hybrid for Ugandan digital readers.
- Strong news lead (who/what/where/when + significance) in the first 2–3 sentences.
- Develop the story in short paragraphs (2–4 sentences each).
- Use clear section flow: lead → context → details from notes → impact/stakeholders → what happens next / open questions.
- Prefer concrete verbs and specific detail from the notes over vague filler ("stakeholders", "various initiatives") unless the notes use those terms.
- If notes list programmes, features, or bullets, turn them into readable prose with transitions — not a raw bullet dump.
- Attribute carefully: if the notes do not name a speaker, do not invent quotes.
- Do not invent statistics, dates, officials, organisations, or outcomes not present in the notes.
- When notes are incomplete, say so in journalistic language ("details were not immediately available", "the brief did not specify…").

Return ONLY valid JSON with keys:
{
  "title": "…",          // max ~110 characters, active and specific
  "summary": "…",        // 2–3 sentences, ~320–450 characters, captures the news value
  "body": "…",           // full article plain text, paragraphs separated by blank lines (no HTML)
  "tags": ["…"],         // 4–8 short topical tags
  "wordCount": 1234      // integer word count of body
}`;

    const user = `Target body length: ${targetWords} words (range ${minBody}–${maxBody})
Tone: ${tone}
Category hint: ${category || 'unspecified'}
District / location hint: ${district || 'unspecified'}
Working title hint: ${titleHint || 'none'}

Reporter notes (sole source of hard facts — expand intelligently, do not invent):
${notes}`;

    let result;
    try {
      // Longer timeout for long-form drafts
      result = await chatJson({ system, user, timeoutMs: 120000 });
    } catch (err) {
      if (/OPENAI_API_KEY|not configured/i.test(err.message)) {
        const firstLine = notes.split(/\n/).map((s) => s.trim()).filter(Boolean)[0] || 'Draft story';
        return res.json({
          draft: {
            title: titleHint || firstLine.slice(0, 110),
            summary: notes.slice(0, 400),
            body: notes,
            tags: category ? [category.toLowerCase()] : [],
            wordCount: countWords(notes),
            targetWords,
          },
          model: 'local-scaffold',
          warning: 'AI key not configured on server; returned a notes scaffold. Set OPENAI_API_KEY for full drafting.',
        });
      }
      throw err;
    }

    const data = result.data || {};
    let body = String(data.body || '').trim();
    let wordCount = countWords(body);

    // One repair pass if the model under- or over-shoots length badly
    if (body && (wordCount < minBody * 0.85 || wordCount > maxBody * 1.25)) {
      try {
        const repair = await chatJson({
          system: `You revise news article body length only. Keep every factual claim; do not invent new facts.
Return ONLY JSON: {"body":"...","wordCount":N}
Target ${targetWords} words (range ${minBody}–${maxBody}). Current count is ${wordCount}.`,
          user: `Title: ${data.title || titleHint}\n\nBody to revise:\n${body}`,
          timeoutMs: 120000,
        });
        if (repair.data?.body) {
          body = String(repair.data.body).trim();
          wordCount = countWords(body);
        }
      } catch {
        // keep original body
      }
    }

    const draft = {
      title: String(data.title || titleHint || '').trim().slice(0, 300),
      summary: String(data.summary || '').trim().slice(0, 600),
      body,
      tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).slice(0, 40)).slice(0, 12) : [],
      wordCount,
      targetWords,
    };
    if (!draft.title || !draft.body) {
      return res.status(502).json({ error: 'AI returned an incomplete draft. Try again with clearer notes.' });
    }

    const lengthWarning = wordCount < minBody
      ? `Draft is shorter than requested (${wordCount} vs ~${targetWords} words). You may regenerate or expand manually.`
      : wordCount > maxBody
        ? `Draft is longer than requested (${wordCount} vs ~${targetWords} words). Trim if needed.`
        : null;

    res.json({
      draft,
      model: result.model,
      usage: result.usage || null,
      warning: lengthWarning,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/draft-story/presets', (_req, res) => {
  res.json({
    presets: [
      { key: 'short', label: 'Short news', words: WORD_COUNT_PRESETS.short },
      { key: 'medium', label: 'Medium', words: WORD_COUNT_PRESETS.medium },
      { key: 'long', label: 'Long (recommended)', words: WORD_COUNT_PRESETS.long },
      { key: 'feature', label: 'Feature', words: WORD_COUNT_PRESETS.feature },
    ],
    minWords: MIN_WORDS,
    maxWords: MAX_WORDS,
    defaultPreset: 'long',
  });
});

module.exports = router;
module.exports.WORD_COUNT_PRESETS = WORD_COUNT_PRESETS;
