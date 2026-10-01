const DEFAULT_MAX_CHUNK_CHARS = 1000;
const DEFAULT_MAX_CHUNKS_PER_ARTICLE = 1000;

const SENTENCE_BOUNDARIES = [". ", "! ", "? ", "; ", "。", "！", "？"];

const MIN_CUT_RATIO = 0.4;

const splitParagraphs = (text) => {
  if (typeof text !== "string") return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

const findCut = (slice, maxChars) => {
  const minCut = Math.floor(maxChars * MIN_CUT_RATIO);
  for (const boundary of SENTENCE_BOUNDARIES) {
    const at = slice.lastIndexOf(boundary);
    if (at >= minCut) return at + boundary.length;
  }
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= minCut) return lastSpace + 1;
  return maxChars;
};

const hardSplit = (text, maxChars) => {
  const pieces = [];
  let rest = text;
  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars);
    const cut = findCut(slice, maxChars);
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length) pieces.push(rest);
  return pieces;
};

const chunkText = (text, opts = {}) => {
  const maxChars = Number.isFinite(opts.maxChunkChars) && opts.maxChunkChars > 0
    ? opts.maxChunkChars
    : DEFAULT_MAX_CHUNK_CHARS;
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return [];

  const chunks = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      for (const piece of hardSplit(paragraph, maxChars)) chunks.push(piece);
    } else {
      chunks.push(paragraph);
    }
  }

  return chunks.map((body, index) => ({ index, body }));
};

module.exports = {
  DEFAULT_MAX_CHUNK_CHARS,
  DEFAULT_MAX_CHUNKS_PER_ARTICLE,
  splitParagraphs,
  hardSplit,
  chunkText,
};