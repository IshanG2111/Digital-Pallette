import { ControlState } from "@/types";
import { rgbToLab, labToRgb } from "./colorMath";
import type { ZoneTransform } from "./workers/lutAnalysisWorker";

export type { ZoneTransform };

// ─── Re-export simple stats interface ─────────────────────────────────────────

export interface ChannelStats {
  rMean: number; rStd: number;
  gMean: number; gStd: number;
  bMean: number; bStd: number;
  mean: [number, number, number];
  cov: [number, number, number, number, number, number, number, number, number];
}

// ─── Clamp helper ─────────────────────────────────────────────────────────────

export function clamp(v: number, lo = 0, hi = 255): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ─── Zone blending weights ────────────────────────────────────────────────────
// L in [0, 100].  Zones: shadow < 40, mid 40–75, high ≥ 75.
// Smooth transitions via soft-step to avoid visible banding.

function zoneWeights(L: number): [number, number, number] {
  // Shadow weight
  const ws = L < 40
    ? 1 - Math.max(0, (L - 30) / 10)  // ramp down 30→40
    : 0;
  // Highlight weight
  const wh = L > 65
    ? Math.max(0, (L - 65) / 10)       // ramp up 65→75
    : 0;
  // Midtone fills the rest
  const wm = Math.max(0, 1 - ws - wh);
  const sum = ws + wm + wh;
  return [ws / sum, wm / sum, wh / sum];
}

// ─── Apply a single zone transform to one LAB pixel ──────────────────────────

function applyZoneTransform(
  lab: [number, number, number],
  zt: ZoneTransform
): [number, number, number] {
  const d0 = lab[0] - zt.srcMean[0];
  const d1 = lab[1] - zt.srcMean[1];
  const d2 = lab[2] - zt.srcMean[2];
  const M = zt.M;
  return [
    M[0] * d0 + M[1] * d1 + M[2] * d2 + zt.tgtMean[0],
    M[3] * d0 + M[4] * d1 + M[5] * d2 + zt.tgtMean[1],
    M[6] * d0 + M[7] * d1 + M[8] * d2 + zt.tgtMean[2],
  ];
}

// ─── High-quality colour transfer for a single RGB pixel ──────────────────────
// Applies zone-aware Cholesky LAB transform, then blends with existing controls.

export function transferColorLAB(
  r: number,
  g: number,
  b: number,
  zoneTransforms: [ZoneTransform, ZoneTransform, ZoneTransform],
  intensity: number   // 0–1
): [number, number, number] {
  const lab = rgbToLab(r, g, b);
  const L = lab[0];

  const [ws, wm, wh] = zoneWeights(L);

  const shadow = applyZoneTransform(lab, zoneTransforms[0]);
  const mid    = applyZoneTransform(lab, zoneTransforms[1]);
  const high   = applyZoneTransform(lab, zoneTransforms[2]);

  const mixed: [number, number, number] = [
    ws * shadow[0] + wm * mid[0] + wh * high[0],
    ws * shadow[1] + wm * mid[1] + wh * high[1],
    ws * shadow[2] + wm * mid[2] + wh * high[2],
  ];

  const transferred = labToRgb(mixed[0], mixed[1], mixed[2]);

  // Blend original → transferred by intensity
  return [
    r + (transferred[0] - r) * intensity,
    g + (transferred[1] - g) * intensity,
    b + (transferred[2] - b) * intensity,
  ];
}

// ─── Legacy per-pixel grade (kept for fallback / export canvas path) ──────────

export function applyColorGrade(
  data: Uint8ClampedArray,
  paletteColors: [number, number, number][],
  controls: ControlState,
  zoneTransforms?: [ZoneTransform, ZoneTransform, ZoneTransform]
): void {
  const intFact     = controls.intensity / 100;
  const contFact    = 1 + controls.contrast / 100;
  const satFact     = 1 + controls.saturation / 100;
  const tempFact    = controls.temperature / 100;
  const expFact     = controls.exposure / 100;
  const highFact    = controls.highlights / 100;
  const shadFact    = controls.shadows / 100;
  const tintFact    = controls.tint / 100;
  const vibFact     = controls.vibrance / 100;
  const skinProtect = controls.skinToneProtection;
  const numColors   = paletteColors.length;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // Skin tone mask
    let skinMask = 1;
    if (skinProtect) {
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && (maxC - minC) > 15 && Math.abs(r - g) > 15 && r > g && r > b)
        skinMask = 0.3;
    }

    // Stage 1 — Covariance LAB transfer (if available)
    if (zoneTransforms && intFact > 0) {
      [r, g, b] = transferColorLAB(r, g, b, zoneTransforms, intFact * skinMask);
    }

    // Stage 2 — Lightroom-style primary adjustments
    r = clamp(r * Math.pow(2, expFact)); g = clamp(g * Math.pow(2, expFact)); b = clamp(b * Math.pow(2, expFact));
    r = clamp(((r / 255 - 0.5) * contFact + 0.5) * 255);
    g = clamp(((g / 255 - 0.5) * contFact + 0.5) * 255);
    b = clamp(((b / 255 - 0.5) * contFact + 0.5) * 255);

    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const hMask = Math.max(0, (luma - 128) / 127);
    const sMask = Math.max(0, (127 - luma) / 127);
    const hMult = 1 + highFact * hMask;
    const sMult = 1 + shadFact * sMask;
    r = clamp(r * hMult * sMult); g = clamp(g * hMult * sMult); b = clamp(b * hMult * sMult);

    r = clamp(r + tempFact * 30 + tintFact * 15);
    b = clamp(b - tempFact * 30);
    g = clamp(g + tempFact * 8 - tintFact * 15);

    const newLuma = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) === 0 ? 0 : (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
    const vib = vibFact * (1 - sat);
    const totalSat = satFact + vib;
    r = clamp(newLuma + (r - newLuma) * totalSat);
    g = clamp(newLuma + (g - newLuma) * totalSat);
    b = clamp(newLuma + (b - newLuma) * totalSat);

    // Stage 3 — Luma-bucketed palette tint (fallback path when no zone transforms)
    if (!zoneTransforms && numColors > 0 && intFact > 0) {
      const pLuma = 0.299 * r + 0.587 * g + 0.114 * b;
      const idx = Math.min(numColors - 1, Math.floor((pLuma / 255) * numColors));
      const pc = paletteColors[idx];
      const s = intFact * skinMask;
      r = clamp(r * (1 - s) + pc[0] * (pLuma / 255) * s);
      g = clamp(g * (1 - s) + pc[1] * (pLuma / 255) * s);
      b = clamp(b * (1 - s) + pc[2] * (pLuma / 255) * s);
    }

    data[i] = r; data[i + 1] = g; data[i + 2] = b;
  }
}

// ─── 3D LUT generation with trilinear baking ─────────────────────────────────
// Bakes current grade + optional LAB zone transforms into a .CUBE file.

export function generateCubeLUT(
  paletteColors: [number, number, number][],
  controls: ControlState,
  size = 33,
  zoneTransforms?: [ZoneTransform, ZoneTransform, ZoneTransform]
): string {
  const lines: string[] = [
    `TITLE "DirectorsPalette_v2"`,
    `# Generated by Director's Palette — High-Quality LAB Pipeline`,
    `# Zones: shadow/midtone/highlight Cholesky covariance transfer`,
    `LUT_3D_SIZE ${size}`,
    ``,
  ];

  // CUBE spec iterates B outer, G middle, R inner
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        const data = new Uint8ClampedArray(4);
        data[0] = Math.round((ri / (size - 1)) * 255);
        data[1] = Math.round((gi / (size - 1)) * 255);
        data[2] = Math.round((bi / (size - 1)) * 255);
        data[3] = 255;
        applyColorGrade(data, paletteColors, controls, zoneTransforms);
        lines.push(
          `${(data[0] / 255).toFixed(6)} ${(data[1] / 255).toFixed(6)} ${(data[2] / 255).toFixed(6)}`
        );
      }
    }
  }

  return lines.join("\n");
}

// ─── Trilinear LUT lookup (for JS-side apply, not WebGL) ─────────────────────

export function applyLutToPixel(
  r: number,
  g: number,
  b: number,
  lut: Float32Array,  // [size³ × 3], R-inner, G-middle, B-outer
  size: number
): [number, number, number] {
  const s1 = size - 1;
  const rn = (r / 255) * s1;
  const gn = (g / 255) * s1;
  const bn = (b / 255) * s1;

  const r0 = Math.floor(rn), r1 = Math.min(r0 + 1, s1);
  const g0 = Math.floor(gn), g1 = Math.min(g0 + 1, s1);
  const b0 = Math.floor(bn), b1 = Math.min(b0 + 1, s1);

  const fr = rn - r0, fg = gn - g0, fb = bn - b0;

  const idx = (bi: number, gi: number, ri: number) => (bi * size * size + gi * size + ri) * 3;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const result: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c000 = lut[idx(b0, g0, r0) + ch];
    const c100 = lut[idx(b0, g0, r1) + ch];
    const c010 = lut[idx(b0, g1, r0) + ch];
    const c110 = lut[idx(b0, g1, r1) + ch];
    const c001 = lut[idx(b1, g0, r0) + ch];
    const c101 = lut[idx(b1, g0, r1) + ch];
    const c011 = lut[idx(b1, g1, r0) + ch];
    const c111 = lut[idx(b1, g1, r1) + ch];

    result[ch] = lerp(
      lerp(lerp(c000, c100, fr), lerp(c010, c110, fr), fg),
      lerp(lerp(c001, c101, fr), lerp(c011, c111, fr), fg),
      fb
    ) * 255;
  }
  return result;
}

// ─── Channel stats (kept for WebGL histogram match path) ─────────────────────

export function computeChannelStats(data: Uint8ClampedArray): ChannelStats {
  const n = data.length / 4;
  let rs = 0, gs = 0, bs = 0;
  for (let i = 0; i < data.length; i += 4) { rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; }
  const rM = rs / n, gM = gs / n, bM = bs / n;
  
  let c00=0, c01=0, c02=0;
  let c11=0, c12=0;
  let c22=0;
  
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - rM;
    const dg = data[i + 1] - gM;
    const db = data[i + 2] - bM;
    c00 += dr * dr; c01 += dr * dg; c02 += dr * db;
    c11 += dg * dg; c12 += dg * db;
    c22 += db * db;
  }
  
  return {
    rMean: rM, rStd: Math.sqrt(c00 / n),
    gMean: gM, gStd: Math.sqrt(c11 / n),
    bMean: bM, bStd: Math.sqrt(c22 / n),
    mean: [rM, gM, bM],
    cov: [
      c00/n, c01/n, c02/n,
      c01/n, c11/n, c12/n,
      c02/n, c12/n, c22/n
    ]
  };
}

export function computeCholesky(cov: number[]): number[] {
  // Add epsilon to diagonal for strict positive-definiteness
  const eps = 1e-4;
  const a00 = cov[0]+eps, a01 = cov[1], a02 = cov[2];
  const a11 = cov[4]+eps, a12 = cov[5];
  const a22 = cov[8]+eps;

  const l00 = Math.sqrt(Math.max(a00, eps));
  const l10 = a01 / l00;
  const l20 = a02 / l00;
  
  const l11 = Math.sqrt(Math.max(a11 - l10*l10, eps));
  const l21 = (a12 - l20*l10) / l11;
  
  const l22 = Math.sqrt(Math.max(a22 - l20*l20 - l21*l21, eps));
  
  // Return lower triangular L
  return [
    l00, 0, 0,
    l10, l11, 0,
    l20, l21, l22
  ];
}

export function invertCholesky(L: number[]): number[] {
  const l00 = L[0];
  const l10 = L[3], l11 = L[4];
  const l20 = L[6], l21 = L[7], l22 = L[8];

  const i00 = 1 / l00;
  const i10 = -l10 * i00 / l11;
  const i11 = 1 / l11;
  const i20 = -(l20 * i00 + l21 * i10) / l22;
  const i21 = -l21 * i11 / l22;
  const i22 = 1 / l22;

  return [
    i00, 0, 0,
    i10, i11, 0,
    i20, i21, i22
  ];
}

export function multiplyMat3(A: number[], B: number[]): number[] {
  const out = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i*3+j] = A[i*3+0]*B[0*3+j] + A[i*3+1]*B[1*3+j] + A[i*3+2]*B[2*3+j];
    }
  }
  return out;
}

// ─── Video Barcode Renderer Helpers ──────────────────────────────────────────

export interface FrameData {
  timestamp: number;
  color: { r: number; g: number; b: number };
  peaks: any;
  palette: [number, number, number][];
  isSceneChange: boolean;
}

export function calculateEuclideanDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// ─── Extract Dominant Colors via K-Means in LAB Space ────────────────────────

export function extractDominantColorsLAB(
  data: Uint8ClampedArray,
  k: number,
  maxSamples: number = 2000
): [number, number, number][] {
  // 1. Sample pixels (skip transparent)
  const samplesLAB: [number, number, number][] = [];
  const step = Math.max(4, Math.floor(data.length / (maxSamples * 4)) * 4);
  
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    samplesLAB.push(rgbToLab(r, g, b));
    if (samplesLAB.length >= maxSamples) break;
  }

  if (samplesLAB.length === 0) {
    return Array(k).fill([0, 0, 0]);
  }

  // 2. K-means setup
  const centroids: [number, number, number][] = [];
  // Initialize uniformly to avoid clustering dead zones
  const stride = Math.floor(samplesLAB.length / k);
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * stride + Math.floor(Math.random()*(stride/2)), samplesLAB.length - 1);
    centroids.push([...samplesLAB[idx]] as [number, number, number]);
  }

  const maxIters = 15;
  for (let iter = 0; iter < maxIters; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);

    for (let i = 0; i < samplesLAB.length; i++) {
      const sample = samplesLAB[i];
      let minDist = Infinity;
      let closestIdx = 0;
      for (let c = 0; c < k; c++) {
        const centroid = centroids[c];
        const dist = Math.pow(sample[0] - centroid[0], 2) +
                     Math.pow(sample[1] - centroid[1], 2) +
                     Math.pow(sample[2] - centroid[2], 2);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = c;
        }
      }
      clusters[closestIdx].push(sample);
    }

    let changed = false;
    for (let c = 0; c < k; c++) {
      const cluster = clusters[c];
      if (cluster.length === 0) continue;
      let sumL = 0, sumA = 0, sumB = 0;
      for (let j = 0; j < cluster.length; j++) {
        sumL += cluster[j][0];
        sumA += cluster[j][1];
        sumB += cluster[j][2];
      }
      const newL = sumL / cluster.length;
      const newA = sumA / cluster.length;
      const newB = sumB / cluster.length;

      const diff = Math.abs(centroids[c][0] - newL) + Math.abs(centroids[c][1] - newA) + Math.abs(centroids[c][2] - newB);
      if (diff > 0.01) changed = true;

      centroids[c] = [newL, newA, newB];
    }
    if (!changed) break;
  }

  // 3. Convert LAB back to RGB and sort by Lightness (L*)
  const enriched = centroids.map(c => {
    const rgb = labToRgb(c[0], c[1], c[2]);
    return {
      luma: c[0],
      rgb: [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])] as [number, number, number]
    };
  });

  return enriched.sort((a, b) => a.luma - b.luma).map(e => e.rgb);
}
