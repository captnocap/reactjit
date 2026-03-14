/**
 * OPML import/export — standard format for sharing RSS subscription lists.
 */

export interface OPMLOutline {
  text: string;
  title: string;
  xmlUrl: string;
  htmlUrl: string;
  type: string;
  category: string;
}

/**
 * Parse an OPML file into a list of feed URLs + metadata.
 *
 * @example
 * const outlines = parseOPML(opmlXml);
 * const urls = outlines.map(o => o.xmlUrl);
 * const { items } = useRSSAggregate(urls);
 */
export function parseOPML(xml: string): OPMLOutline[] {
  const outlines: OPMLOutline[] = [];
  // Match all <outline> tags with xmlUrl attribute
  const re = /<outline\s[^>]*xmlUrl=["']([^"']+)["'][^>]*\/?>/gi;
  let m;

  while ((m = re.exec(xml))) {
    const tag = m[0];
    const xmlUrl = m[1];

    const getAttr = (name: string): string => {
      const attrRe = new RegExp(`${name}=["']([^"']*?)["']`, 'i');
      const match = tag.match(attrRe);
      return match ? match[1] : '';
    };

    outlines.push({
      text: getAttr('text'),
      title: getAttr('title') || getAttr('text'),
      xmlUrl,
      htmlUrl: getAttr('htmlUrl'),
      type: getAttr('type') || 'rss',
      category: getAttr('category'),
    });
  }

  return outlines;
}

/**
 * Generate an OPML file from a list of feed subscriptions.
 *
 * @example
 * const opml = generateOPML('My Feeds', [
 *   { title: 'HN', xmlUrl: 'https://hnrss.org/frontpage', htmlUrl: 'https://news.ycombinator.com' },
 * ]);
 */
export function generateOPML(
  title: string,
  feeds: Array<{ title: string; xmlUrl: string; htmlUrl?: string; category?: string }>,
): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const outlines = feeds.map(f =>
    `      <outline type="rss" text="${escape(f.title)}" title="${escape(f.title)}" xmlUrl="${escape(f.xmlUrl)}"${f.htmlUrl ? ` htmlUrl="${escape(f.htmlUrl)}"` : ''}${f.category ? ` category="${escape(f.category)}"` : ''} />`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escape(title)}</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Feeds">
${outlines}
    </outline>
  </body>
</opml>`;
}
