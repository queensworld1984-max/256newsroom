function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch]));
}

function cdata(value) {
  return `<![CDATA[${String(value ?? '').replace(/]]>/g, ']]&gt;')}]]>`;
}

function rfc822(date) {
  const d = date ? new Date(date) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

// Every row here must already be filtered by the caller to: status =
// 'published', hidden = false, and (for org-authored/imported rows) an
// approved/active/is_official organization — drafts, scheduled, withdrawn,
// private, suspended-publisher and unapproved-org content must never reach
// this function.
function buildRssXml({ title, description, link, selfUrl, items }) {
  const itemsXml = items.map((item) => `
    <item>
      <title>${cdata(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="${item.guidIsLink ? 'true' : 'false'}">${escapeXml(item.guid || item.link)}</guid>
      <pubDate>${rfc822(item.publishedAt)}</pubDate>
      ${item.description ? `<description>${cdata(item.description)}</description>` : ''}
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ''}
      ${item.author ? `<author>${escapeXml(item.author)}</author>` : ''}
      ${item.imageUrl ? `<enclosure url="${escapeXml(item.imageUrl)}" type="image/jpeg"/>` : ''}
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-ug</language>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${rfc822(items[0]?.publishedAt)}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
}

function sendRss(res, xml) {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.send(xml);
}

module.exports = { buildRssXml, sendRss };
