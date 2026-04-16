// File: src/utils/chunker.js
//
// Splits an array of pages into fixed-size chunks for sequential AI evaluation.
// Keeping chunks at ~30 pages balances context quality vs. API token limits.

export const PAGES_PER_CHUNK = 30;

/**
 * @typedef {{ pageNum: number, text: string }} Page
 * @typedef {{
 *   index:     number,
 *   label:     string,
 *   startPage: number,
 *   endPage:   number,
 *   text:      string,
 *   wordCount: number,
 * }} Chunk
 */

/**
 * Split extracted PDF pages into evaluation chunks.
 *
 * @param {Page[]} pages
 * @param {number} [pagesPerChunk]
 * @returns {Chunk[]}
 */
export function buildChunks(pages, pagesPerChunk = PAGES_PER_CHUNK) {
  const chunks = [];

  for (let i = 0; i < pages.length; i += pagesPerChunk) {
    const slice     = pages.slice(i, i + pagesPerChunk);
    const startPage = slice[0].pageNum;
    const endPage   = slice[slice.length - 1].pageNum;
    const text      = slice.map((p) => `[Page ${p.pageNum}]\n${p.text}`).join('\n\n');
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    chunks.push({
      index:  chunks.length,
      label:  `Pages ${startPage}–${endPage}`,
      startPage,
      endPage,
      text,
      wordCount,
    });
  }

  return chunks;
}

/**
 * Estimate total word count across all pages.
 * @param {Page[]} pages
 */
export function estimateWordCount(pages) {
  return pages.reduce((sum, p) => {
    return sum + p.text.split(/\s+/).filter(Boolean).length;
  }, 0);
}
