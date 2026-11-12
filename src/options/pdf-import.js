/* 简填 · PDF 文本提取（pdf.js）
 * 只在设置页加载；读取 PDF 需要用户主动选择文件。
 */
import * as pdfjsLib from '../../vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdfjs/pdf.worker.min.mjs');

const CMAP_URL = chrome.runtime.getURL('vendor/pdfjs/cmaps/');
const FONT_URL = chrome.runtime.getURL('vendor/pdfjs/standard_fonts/');

function lineKey(y) {
  return Math.round(y / 3) * 3;
}

function pageText(items) {
  const rows = new Map();

  for (const item of items) {
    if (!item || typeof item.str !== 'string' || !item.str) continue;
    const key = lineKey(item.transform[5]);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: item.transform[4], str: item.str, eol: !!item.hasEOL });
  }

  const keys = Array.from(rows.keys()).sort((a, b) => b - a);
  const lines = [];

  for (const key of keys) {
    const parts = rows.get(key).sort((a, b) => a.x - b.x);
    let text = '';
    for (const part of parts) {
      if (text && /[A-Za-z0-9]$/.test(text) && /^[A-Za-z0-9]/.test(part.str)) text += ' ';
      text += part.str;
      if (part.eol) {
        if (text.trim()) lines.push(text.trim());
        text = '';
      }
    }
    if (text.trim()) lines.push(text.trim());
  }

  return lines.join('\n');
}

async function extractText(file) {
  if (!file) throw new Error('没有选择文件');
  if (file.size > 20 * 1024 * 1024) throw new Error('PDF 超过 20MB，请换一个小一点的文件');

  const buffer = await file.arrayBuffer();
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: FONT_URL,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;

  try {
    const pages = Math.min(document.numPages, 30);
    const chunks = [];
    for (let index = 1; index <= pages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      chunks.push(pageText(content.items));
      page.cleanup();
    }
    return chunks.join('\n\n').replace(/\u0000/g, '').trim();
  } finally {
    await document.destroy();
  }
}

window.RFPDF = {
  extractText,
  parse: (text) => window.RF.parseResumeText(text),
  version: '4.10.38'
};
window.dispatchEvent(new Event('rf-pdf-ready'));
