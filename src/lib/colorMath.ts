/**
 * Color Math Primitives — LAB ↔ RGB, matrix ops, Cholesky decomposition.
 * Pure TypeScript, zero dependencies. Used by both the main thread and workers.
 */

// ─── sRGB ↔ Linear ────────────────────────────────────────────────────────────

export function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308
    ? c * 12.92 * 255
    : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;
}

// ─── sRGB → XYZ (D65) ────────────────────────────────────────────────────────

export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // BT.709 / sRGB primaries, D65 white
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  return [x, y, z];
}

export function xyzToRgb(x: number, y: number, z: number): [number, number, number] {
  const rl =  x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
  const gl = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bl =  x * 0.0556434 - y * 0.2040259 + z * 1.0572252;
  return [
    Math.max(0, Math.min(255, linearToSrgb(Math.max(0, rl)))),
    Math.max(0, Math.min(255, linearToSrgb(Math.max(0, gl)))),
    Math.max(0, Math.min(255, linearToSrgb(Math.max(0, bl)))),
  ];
}

// ─── XYZ → LAB (D65) ─────────────────────────────────────────────────────────

const D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

function fLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function fLabInv(t: number): number {
  return t > 0.206897 ? t * t * t : (t - 16 / 116) / 7.787;
}

export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = fLab(x / D65.x);
  const fy = fLab(y / D65.y);
  const fz = fLab(z / D65.z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToXyz(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return [fLabInv(fx) * D65.x, fLabInv(fy) * D65.y, fLabInv(fz) * D65.z];
}

// ─── Convenience: RGB ↔ LAB ───────────────────────────────────────────────────

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  return xyzToLab(...rgbToXyz(r, g, b));
}

export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  return xyzToRgb(...labToXyz(L, a, b));
}

// ─── Matrix operations (3x3, row-major) ──────────────────────────────────────

export type Mat3 = Float64Array; // length 9, row-major

export function mat3Id(): Mat3 {
  return new Float64Array([1, 0, 0,  0, 1, 0,  0, 0, 1]);
}

export function mat3Mul(A: Mat3, B: Mat3): Mat3 {
  const C = new Float64Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
  return C;
}

export function mat3MulVec(M: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
  ];
}

export function mat3Transpose(M: Mat3): Mat3 {
  return new Float64Array([
    M[0], M[3], M[6],
    M[1], M[4], M[7],
    M[2], M[5], M[8],
  ]);
}

// ─── Cholesky decomposition (lower triangular L such that A = L×Lᵀ) ──────────
// A must be symmetric positive definite (3×3 covariance matrix).

export function cholesky(A: Mat3): Mat3 | null {
  const L = new Float64Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * 3 + j];
      for (let k = 0; k < j; k++) sum -= L[i * 3 + k] * L[j * 3 + k];
      if (i === j) {
        if (sum <= 0) return null; // not positive definite
        L[i * 3 + j] = Math.sqrt(sum);
      } else {
        L[i * 3 + j] = sum / L[j * 3 + j];
      }
    }
  }
  return L;
}

// Solve L × x = b (forward substitution)
function forwardSolve(L: Mat3, b: [number, number, number]): [number, number, number] {
  const x: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i * 3 + k] * x[k];
    x[i] = sum / L[i * 3 + i];
  }
  return x;
}

// Solve Lᵀ × x = b (back substitution)
function backSolve(L: Mat3, b: [number, number, number]): [number, number, number] {
  const x: [number, number, number] = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let sum = b[i];
    for (let k = i + 1; k < 3; k++) sum -= L[k * 3 + i] * x[k];
    x[i] = sum / L[i * 3 + i];
  }
  return x;
}

// Invert a lower-triangular Cholesky factor (L → L⁻¹)
export function choleskyInv(L: Mat3): Mat3 {
  const inv = new Float64Array(9);
  for (let col = 0; col < 3; col++) {
    const e: [number, number, number] = [col === 0 ? 1 : 0, col === 1 ? 1 : 0, col === 2 ? 1 : 0];
    const x = forwardSolve(L, e);
    for (let row = 0; row < 3; row++) inv[row * 3 + col] = x[row];
  }
  return inv;
}

// ─── Covariance matrix from (n×3) pixel array in LAB ─────────────────────────

export interface DistributionStats {
  mean: [number, number, number];
  cov: Mat3;        // 3×3 covariance
  chol: Mat3 | null; // Cholesky factor
}

export function computeDistributionStats(pixels: Float32Array, n: number): DistributionStats {
  // 1. Mean
  let m0 = 0, m1 = 0, m2 = 0;
  for (let i = 0; i < n * 3; i += 3) { m0 += pixels[i]; m1 += pixels[i + 1]; m2 += pixels[i + 2]; }
  const mean: [number, number, number] = [m0 / n, m1 / n, m2 / n];

  // 2. Covariance (unbiased)
  const cov = new Float64Array(9);
  for (let i = 0; i < n * 3; i += 3) {
    const d0 = pixels[i]     - mean[0];
    const d1 = pixels[i + 1] - mean[1];
    const d2 = pixels[i + 2] - mean[2];
    cov[0] += d0 * d0; cov[1] += d0 * d1; cov[2] += d0 * d2;
    cov[3] += d1 * d0; cov[4] += d1 * d1; cov[5] += d1 * d2;
    cov[6] += d2 * d0; cov[7] += d2 * d1; cov[8] += d2 * d2;
  }
  const nf = n > 1 ? n - 1 : 1;
  for (let k = 0; k < 9; k++) cov[k] /= nf;

  // Regularise diagonal to ensure PD (Tikhonov)
  cov[0] += 1e-6; cov[4] += 1e-6; cov[8] += 1e-6;

  return { mean, cov, chol: cholesky(cov) };
}
