/**
 * LUT Analysis Worker — High-Quality Color Distribution Pipeline
 *
 * Implements:
 *  1. sRGB → LAB conversion
 *  2. Stratified pixel sampling (5000 pts)
 *  3. Scene-aware zone segmentation (shadows / midtones / highlights)
 *  4. Per-zone covariance matching via Cholesky decomposition
 *  5. Full-image stats for WebGL uniform transfer (mean + std per channel)
 *
 * Posted message: { sourcePixels: ImageData, targetPixels?: ImageData }
 * Response: LutAnalysisResult
 */

import {
  rgbToLab, labToRgb,
  computeDistributionStats,
  mat3Mul, mat3MulVec, mat3Transpose,
  choleskyInv,
  DistributionStats,
} from "../colorMath";

export interface ZoneTransform {
  srcMean: [number, number, number];
  tgtMean: [number, number, number];
  /** Colour transfer matrix M (apply as: lab_out = M @ (lab - srcMean) + tgtMean) */
  M: number[];  // 9 elements, row-major
}

export interface LutAnalysisResult {
  /** Per-zone covariance transforms (shadow / midtone / highlight) */
  zoneTransforms: [ZoneTransform, ZoneTransform, ZoneTransform];
  /** Classic per-channel mean/std for the WebGL histogram uniform (target image) */
  rMean: number; rStd: number;
  gMean: number; gStd: number;
  bMean: number; bStd: number;
}

const ctx: Worker = self as unknown as Worker;

// ─── Stratified sampler ───────────────────────────────────────────────────────

function samplePixels(data: Uint8ClampedArray, n = 5000): Float32Array {
  const total = data.length / 4;
  const out = new Float32Array(n * 3);
  const step = Math.max(1, Math.floor(total / n));
  let j = 0;
  for (let i = 0; i < n; i++) {
    const idx = (i * step) % total;
    const lab = rgbToLab(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2]);
    out[j++] = lab[0];
    out[j++] = lab[1];
    out[j++] = lab[2];
  }
  return out;
}

// ─── Zone segmentation by L channel ─────────────────────────────────────────
//  Shadows   L < 40  (out of 100)
//  Midtones  40 ≤ L < 75
//  Highlights L ≥ 75

function splitZones(pixels: Float32Array, n: number) {
  const shadow: number[] = [], mid: number[] = [], high: number[] = [];
  for (let i = 0; i < n * 3; i += 3) {
    const L = pixels[i];
    const arr = L < 40 ? shadow : L < 75 ? mid : high;
    arr.push(pixels[i], pixels[i + 1], pixels[i + 2]);
  }
  const toFloat32 = (arr: number[]) => new Float32Array(arr);
  return {
    shadow:  toFloat32(shadow),
    mid:     toFloat32(mid),
    high:    toFloat32(high),
  };
}

// ─── Build colour transfer matrix (Cholesky covariance matching) ──────────────
// Given source and target distribution stats in LAB, compute M such that:
//   lab_out = M × (lab_in − src.mean) + tgt.mean
// This is the optimal linear map that transforms src distribution → tgt distribution.

function buildTransferMatrix(src: DistributionStats, tgt: DistributionStats): ZoneTransform {
  // Fallback to identity if Cholesky fails (degenerate zone)
  if (!src.chol || !tgt.chol) {
    return {
      srcMean: src.mean,
      tgtMean: tgt.mean,
      M: [1, 0, 0,  0, 1, 0,  0, 0, 1],
    };
  }

  // M = L_tgt × L_src⁻¹   (both are Cholesky lower-triangular factors)
  const srcInv = choleskyInv(src.chol);
  const M = mat3Mul(tgt.chol, srcInv);

  return {
    srcMean: src.mean,
    tgtMean: tgt.mean,
    M: Array.from(M),
  };
}

// ─── Per-channel RGB mean/std for WebGL uniform ───────────────────────────────

function rgbStats(data: Uint8ClampedArray) {
  const n = data.length / 4;
  let rs = 0, gs = 0, bs = 0;
  for (let i = 0; i < data.length; i += 4) { rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; }
  const rM = rs / n, gM = gs / n, bM = bs / n;
  let rv = 0, gv = 0, bv = 0;
  for (let i = 0; i < data.length; i += 4) {
    rv += (data[i] - rM) ** 2;
    gv += (data[i + 1] - gM) ** 2;
    bv += (data[i + 2] - bM) ** 2;
  }
  return {
    rMean: rM, rStd: Math.sqrt(rv / n),
    gMean: gM, gStd: Math.sqrt(gv / n),
    bMean: bM, bStd: Math.sqrt(bv / n),
  };
}

// ─── Ensure a zone has enough samples to compute meaningful stats ─────────────

function safeStats(pixels: Float32Array, fallback: DistributionStats): DistributionStats {
  const n = pixels.length / 3;
  if (n < 10) return fallback;
  return computeDistributionStats(pixels, n);
}

// ─── Main worker message handler ──────────────────────────────────────────────

ctx.onmessage = function (e: MessageEvent) {
  const { sourcePixels, targetPixels } = e.data as {
    sourcePixels: ImageData;
    targetPixels?: ImageData;
  };

  // 1. Stratified sampling in LAB
  const srcSamples = samplePixels(sourcePixels.data, 5000);
  const N = 5000;

  // 2. Zone split for source
  const srcZones = splitZones(srcSamples, N);
  const srcShadowStats  = computeDistributionStats(srcZones.shadow,  srcZones.shadow.length  / 3 || 1);
  const srcMidStats     = computeDistributionStats(srcZones.mid,     srcZones.mid.length     / 3 || 1);
  const srcHighStats    = computeDistributionStats(srcZones.high,    srcZones.high.length    / 3 || 1);

  // Fallback: use global source stats if a zone is empty
  const srcGlobal = computeDistributionStats(srcSamples, N);

  let zoneTransforms: [ZoneTransform, ZoneTransform, ZoneTransform];

  if (targetPixels) {
    // 3. Zone split for target
    const tgtSamples = samplePixels(targetPixels.data, 5000);
    const tgtZones = splitZones(tgtSamples, N);

    const tgtShadowStats  = safeStats(tgtZones.shadow,  srcGlobal);
    const tgtMidStats     = safeStats(tgtZones.mid,     srcGlobal);
    const tgtHighStats    = safeStats(tgtZones.high,    srcGlobal);

    // 4. Build per-zone Cholesky transfer matrices
    zoneTransforms = [
      buildTransferMatrix(tgtShadowStats,  srcShadowStats),
      buildTransferMatrix(tgtMidStats,     srcMidStats),
      buildTransferMatrix(tgtHighStats,    srcHighStats),
    ];
  } else {
    // No target — identity transforms (source analysis only)
    const identity: ZoneTransform = {
      srcMean: [0, 0, 0], tgtMean: [0, 0, 0],
      M: [1, 0, 0,  0, 1, 0,  0, 0, 1],
    };
    zoneTransforms = [identity, identity, identity];
  }

  // 5. Per-channel RGB stats for WebGL histogram uniform
  const stats = rgbStats(sourcePixels.data);

  const result: LutAnalysisResult = {
    zoneTransforms,
    ...stats,
  };

  ctx.postMessage(result);
};
