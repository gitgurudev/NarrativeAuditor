// File: src/utils/pdfParser.js
//
// Extracts plain text from every page of a PDF File object using PDF.js.
// Returns: { pageCount: number, pages: Array<{ pageNum: number, text: string }> }

import * as pdfjsLib from 'pdfjs-dist';

// Point the worker at the bundled copy inside node_modules.
// Vite resolves this URL at build time — no CDN dependency.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/**
 * @param {File} file - a PDF File object from an <input type="file"> or drop event
 * @param {(current: number, total: number) => void} [onProgress] - called per page
 * @returns {Promise<{ pageCount: number, pages: Array<{ pageNum: number, text: string }> }>}
 */
export async function extractPdfText(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const pages = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page    = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Join text items; preserve paragraph breaks by detecting y-position gaps
    let lastY = null;
    let lineText = '';
    const lines = [];

    for (const item of content.items) {
      if ('str' in item) {
        const currentY = item.transform[5];

        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          // New line detected
          if (lineText.trim()) lines.push(lineText.trim());
          lineText = '';
        }

        lineText += item.str;
        lastY = currentY;
      }
    }
    if (lineText.trim()) lines.push(lineText.trim());

    pages.push({ pageNum, text: lines.join('\n') });

    if (onProgress) onProgress(pageNum, pageCount);
  }

  return { pageCount, pages };
}
