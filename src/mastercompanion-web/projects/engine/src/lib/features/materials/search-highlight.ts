/** Literal terms become text segments; callers render interpolation, never HTML. */
export function searchHighlight(
  text: string,
  query: string,
): readonly { text: string; matched: boolean }[] {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) {
    return [{ text, matched: false }];
  }
  const pattern = new RegExp(
    terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|'),
    'giu',
  );
  const parts: { text: string; matched: boolean }[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) {
      parts.push({ text: text.slice(end, match.index), matched: false });
    }
    parts.push({ text: match[0], matched: true });
    end = match.index + match[0].length;
  }
  if (end < text.length) {
    parts.push({ text: text.slice(end), matched: false });
  }
  return parts;
}
