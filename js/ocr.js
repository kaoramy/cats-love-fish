// Локальное распознавание: Tesseract.js (WebAssembly) + jsQR. Ничего не отправляется в сеть —
// все файлы движка и языков лежат в папке приложения и кэшируются для офлайна.
import { parseFiscalQR } from './parser.js';

const BASE = new URL('../vendor/', import.meta.url).href;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.dataset.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не удалось загрузить ' + src));
    document.head.appendChild(s);
  });
}

export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img; // браузер сам учитывает EXIF-поворот
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

// Рисуем с поворотом и масштабом. Длинная сторона ≤ maxSide.
export function drawToCanvas(img, rotation = 0, maxSide = 2400, minShort = 1100) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  let scale = Math.min(1, maxSide / Math.max(w0, h0));
  if (Math.min(w0, h0) * scale < minShort) scale = Math.min(maxSide / Math.max(w0, h0), minShort / Math.min(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const rot = ((rotation % 360) + 360) % 360;
  const c = document.createElement('canvas');
  c.width = rot % 180 ? h : w;
  c.height = rot % 180 ? w : h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

// Выравнивание освещения: делим на размытый фон, затем растягиваем контраст.
// Убирает тени от руки/телефона и серый фон термобумаги, не превращая текст в «ломаные» пиксели.
export function preprocess(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; p < g.length; i += 4, p++) g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  // интегральное изображение
  const W = w + 1;
  const integ = new Float64Array(W * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += g[(y - 1) * w + (x - 1)];
      integ[y * W + x] = integ[(y - 1) * W + x] + row;
    }
  }
  const r = Math.max(12, Math.round(Math.min(w, h) / 18));
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const sum = integ[y1 * W + x1] - integ[y0 * W + x1] - integ[y1 * W + x0] + integ[y0 * W + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      // фон ≈ максимум из локального среднего и самого пикселя
      const bg = Math.max(mean * 1.08, 1);
      out[y * w + x] = Math.min(255, (g[y * w + x] / bg) * 255);
    }
  }
  // растяжка контраста по перцентилям
  const hist = new Uint32Array(256);
  for (let p = 0; p < out.length; p++) hist[out[p] | 0]++;
  const lo = percentile(hist, out.length, 0.02), hi = percentile(hist, out.length, 0.6);
  const span = Math.max(20, hi - lo);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    let v = ((out[p] - lo) / span) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

function percentile(hist, total, q) {
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * q) return v; }
  return 255;
}

// ---------- QR ----------
export async function scanQR(img) {
  try {
    await loadScript(BASE + 'jsQR.js');
    for (const side of [1400, 900, 2000]) {
      const c = drawToCanvas(img, 0, side, 0);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const id = ctx.getImageData(0, 0, c.width, c.height);
      const code = window.jsQR(id.data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (code && code.data) {
        const fq = parseFiscalQR(code.data);
        return fq || { raw: code.data };
      }
    }
  } catch (e) { console.warn('QR', e); }
  return null;
}

// ---------- Tesseract ----------
export const LANGS = {
  rus: { label: 'Русский чек', langs: ['rus', 'eng'] },
  est: { label: 'Eesti tšekk', langs: ['est', 'eng'] },
};

export async function recognize(canvas, langKey, onProgress = () => {}) {
  await loadScript(BASE + 'tesseract/tesseract.min.js');
  const { createWorker } = window.Tesseract;
  const stageNames = {
    'loading tesseract core': 'Запускаю движок',
    'initializing tesseract': 'Запускаю движок',
    'loading language traineddata': 'Загружаю язык',
    'loading language traineddata (from cache)': 'Загружаю язык',
    'initializing api': 'Готовлюсь',
    'recognizing text': 'Читаю чек',
  };
  const worker = await createWorker(LANGS[langKey].langs, 1, {
    workerPath: BASE + 'tesseract/worker.min.js',
    corePath: BASE + 'tesseract/core',
    langPath: BASE + 'tesseract/lang',
    workerBlobURL: false,
    gzip: true,
    logger: m => onProgress(stageNames[m.status] || m.status, m.progress || 0, m.status),
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '4',     // одна колонка текста разного размера — типично для чека
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const lines = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
      const text = (l.text || '').replace(/\n$/, '');
      if (!text.trim()) continue;
      const wc = (l.words || []).map(w => w.confidence).filter(x => x != null);
      const conf = wc.length ? Math.min(l.confidence ?? 100, wc.reduce((a, b) => a + b, 0) / wc.length) : l.confidence;
      lines.push({ text, conf: conf == null ? null : Math.round(conf), bbox: l.bbox });
    }
    if (!lines.length && data.text) data.text.split('\n').forEach(t => t.trim() && lines.push({ text: t, conf: null }));
    return { lines, text: data.text || '', confidence: data.confidence };
  } finally {
    await worker.terminate(); // освобождаем память — на iPhone это важно
  }
}

// Прогрев офлайн-кэша: запускаем движок на крошечной картинке для каждого языка —
// tesseract сам скачает нужный вариант ядра и словари, а service worker их сохранит.
export async function warmOcrCache(langKeys = ['rus', 'est'], onStep = () => {}) {
  await loadScript(BASE + 'jsQR.js');
  const c = document.createElement('canvas');
  c.width = 200; c.height = 60;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 200, 60);
  ctx.fillStyle = '#000'; ctx.font = '28px sans-serif'; ctx.fillText('OK 1.00', 10, 40);
  for (const k of langKeys) {
    onStep(LANGS[k].label);
    await recognize(c, k);
  }
}

// ---------- PDF (pdf.js из vendor/, офлайн) ----------
export const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');

// Есть текстовый слой → { lines } без OCR. Это скан → { canvas } первой страницы для OCR.
export async function readPdf(file, onProgress = () => {}) {
  await loadScript(BASE + 'pdfjs/pdf.min.js');
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = BASE + 'pdfjs/pdf.worker.min.js';
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  const pages = Math.min(pdf.numPages, 6);
  for (let n = 1; n <= pages; n++) {
    onProgress('Читаю PDF', n / pages / 2);
    const tc = await (await pdf.getPage(n)).getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim())
      .map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || 8 }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let row = [], rowY = null;
    const flush = () => {
      if (!row.length) return;
      row.sort((a, b) => a.x - b.x);
      let text = '', end = null;
      for (const it of row) {
        if (end != null && it.x - end > it.h * 0.15) text += ' ';
        text += it.s;
        end = it.x + it.w;
      }
      lines.push({ text, conf: null });
      row = [];
    };
    for (const it of items) {
      if (rowY != null && Math.abs(it.y - rowY) > Math.max(2, it.h * 0.45)) flush();
      if (!row.length) rowY = it.y;
      row.push(it);
    }
    flush();
  }
  const chars = lines.reduce((a, l) => a + l.text.replace(/\s/g, '').length, 0);
  if (chars >= 30) return { lines };

  // Скан внутри PDF: рисуем первую страницу крупно и отдаём на распознавание.
  const page = await pdf.getPage(1);
  const vp0 = page.getViewport({ scale: 1 });
  const scale = Math.min(3, 2400 / Math.max(vp0.width, vp0.height));
  const vp = page.getViewport({ scale: Math.max(1.5, scale) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas };
}
