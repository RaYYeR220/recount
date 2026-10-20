/** Procedural walnut and felt, painted once per page into offscreen canvases. */

/** Small seeded generator so the grain is the same on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function wood(w: number, h: number, base: string, seed: number): HTMLCanvasElement {
  const c = canvas(w, h);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = seeded(seed);
  for (let i = 0; i < 260; i++) {
    const y0 = r() * h;
    const amp = 1 + r() * 7;
    const freq = 0.002 + r() * 0.006;
    const ph = r() * 6.28;
    const dark = r() < 0.62;
    g.strokeStyle = dark ? `rgba(20,10,4,${0.05 + r() * 0.16})` : `rgba(255,214,160,${0.03 + r() * 0.06})`;
    g.lineWidth = 0.5 + r() * (dark ? 2.2 : 1.2);
    g.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.25;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // a few knots in the figure
  for (let k = 0; k < 5; k++) {
    const x = r() * w;
    const y = r() * h;
    const rx = 30 + r() * 80;
    const ry = 3 + r() * 6;
    g.strokeStyle = "rgba(20,10,4,.12)";
    g.lineWidth = 1;
    for (let j = 0; j < 5; j++) {
      g.beginPath();
      g.ellipse(x, y, rx + j * 9, ry + j * 2.2, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return c;
}

function felt(size: number, base: string, seed: number): HTMLCanvasElement {
  const c = canvas(size, size);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  const r = seeded(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i]! + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1]! + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2]! + n * 0.8));
  }
  g.putImageData(img, 0, 0);
  return c;
}

export type Textures = { wood: HTMLCanvasElement; apron: HTMLCanvasElement; felt: HTMLCanvasElement };

let shared: Textures | null = null;

export function textures(): Textures {
  shared ??= { wood: wood(1600, 420, "#5a3d27", 7), apron: wood(1600, 160, "#3b2717", 19), felt: felt(160, "#2f4a3a", 3) };
  return shared;
}
