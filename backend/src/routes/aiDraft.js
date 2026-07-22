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

// POST /api/ai/draft-story
// Body: { notes, title?, category?, district?, tone? }
// Returns structured draft fields the story form can apply.
router.post('/draft-story', async (req, res, next) => {
  try {
    const notes = String(req.body.notes || '').trim();
    if (notes.length < 20) {
      return res.status(400).json({ error: 'Provide at least 20 characters of notes or facts for the AI drafter.' });
    }
    if (notes.length > 8000) {
      return res.status(400).json({ error: 'Notes are too long (max 8000 characters).' });
    }

    const titleHint = req.body.title ? String(req.body.title).trim().slice(0, 300) : '';
    const category = req.body.category ? String(req.body.category).trim().slice(0, 80) : '';
    const district = req.body.district ? String(req.body.district).trim().slice(0, 80) : '';
    const tone = req.body.tone ? String(req.body.tone).trim().slice(0, 40) : 'straight news';

    const system = `You are a newsroom assistant for 256 Newsroom (Uganda).
Draft clear, factual news copy from reporter notes.
Rules:
- Do not invent facts, names, numbers, quotes, or events not present in the notes.
- If notes are incomplete, write cautiously and keep claims limited to what is given.
- Use neutral wire-style English suitable for Ugandan digital news.
- Return ONLY valid JSON with keys: title, summary, body, tags (array of short strings).
- body may use short paragraphs separated by blank lines (plain text, not HTML).
- summary max ~280 characters; title max ~110 characters.`;

    const user = `Tone: ${tone}
Category hint: ${category || 'unspecified'}
District hint: ${district || 'unspecified'}
Working title hint: ${titleHint || 'none'}

Reporter notes:
${notes}`;

    let result;
    try {
      result = await chatJson({ system, user });
    } catch (err) {
      // Fall back: if OpenAI key missing, return a structured local scaffold so UI still works.
      if (/OPENAI_API_KEY|not configured/i.test(err.message)) {
        const firstLine = notes.split(/\n/).map((s) => s.trim()).filter(Boolean)[0] || 'Draft story';
        return res.json({
          draft: {
            title: titleHint || firstLine.slice(0, 110),
            summary: notes.slice(0, 280),
            body: notes,
            tags: category ? [category.toLowerCase()] : [],
          },
          model: 'local-scaffold',
          warning: 'AI key not configured on server; returned a notes scaffold. Set OPENAI_API_KEY for full drafting.',
        });
      }
      throw err;
    }

    const data = result.data || {};
    const draft = {
      title: String(data.title || titleHint || '').trim().slice(0, 300),
      summary: String(data.summary || '').trim().slice(0, 500),
      body: String(data.body || '').trim(),
      tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).slice(0, 40)).slice(0, 12) : [],
    };
    if (!draft.title || !draft.body) {
      return res.status(502).json({ error: 'AI returned an incomplete draft. Try again with clearer notes.' });
    }

    res.json({ draft, model: result.model, usage: result.usage || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
