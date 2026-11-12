// Эффект напыления (как аэрограф) для фона страницы: цветные пятна рисуются не плавной заливкой,
// а россыпью точек, плотность которых зависит от градиента. Картинка создаётся один раз на телефоне.
// Карточки лежат поверх фона сплошные, поэтому текст на них не страдает.
let urlP = null;

function rng(seed) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

// Пятна в долях размера: x, y — центр, r — радиус (от ширины). Слои кладутся друг на друга.
const BASE = [226, 196, 216];            // светлый Soft Blossom
const LAYERS = [
  { color: [222, 175, 194], blobs: [{ x: .9, y: .12, r: .9 }, { x: .5, y: .62, r: .55 }] },    // Soft Blossom
  { color: [212, 128, 187], blobs: [{ x: 1.02, y: .5, r: .75 }, { x: .2, y: .98, r: .6 }] },   // Petal Pink
  { color: [167, 117, 201], blobs: [{ x: -.05, y: .05, r: 1.0 }, { x: .05, y: .72, r: .6 }, { x: .85, y: 1.05, r: .5 }] }, // Bright Lavender
];

export function grainUrl(W = 720, H = 1280) {
  if (urlP) return urlP;
  urlP = new Promise(resolve => {
    const rand = rng(11);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.fillStyle = `rgb(${BASE})`;
    g.fillRect(0, 0, W, H);
    for (const L of LAYERS) {
      const m = document.createElement('canvas');
      m.width = W; m.height = H;
      const mg = m.getContext('2d');
      for (const b of L.blobs) {
        const gr = mg.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * W);
        gr.addColorStop(0, 'rgba(0,0,0,1)');
        gr.addColorStop(.5, 'rgba(0,0,0,.6)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        mg.fillStyle = gr;
        mg.fillRect(0, 0, W, H);
      }
      const mask = mg.getImageData(0, 0, W, H).data;
      const layer = new ImageData(W, H);
      const d = layer.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = mask[i + 3] / 255;
        if (a > 0 && rand() < a * a * 1.1) {   // квадрат: края разреженные, центр плотный
          d[i] = L.color[0]; d[i + 1] = L.color[1]; d[i + 2] = L.color[2]; d[i + 3] = 255;
        }
      }
      const t = document.createElement('canvas');
      t.width = W; t.height = H;
      t.getContext('2d').putImageData(layer, 0, 0);
      g.drawImage(t, 0, 0);
    }
    out.toBlob(b => resolve(URL.createObjectURL(b)), 'image/png');
  });
  return urlP;
}

// Четырёхконечная искра — фирменный знак.
export const sparkle = (size, color = '#fff', style = '') =>
  `<svg class="spark" width="${size}" height="${size}" viewBox="0 0 24 24" style="${style}" aria-hidden="true"><path d="M12 1.5c.9 6.2 4.3 9.6 10.5 10.5-6.2.9-9.6 4.3-10.5 10.5-.9-6.2-4.3-9.6-10.5-10.5 6.2-.9 9.6-4.3 10.5-10.5z" fill="${color}"/></svg>`;
