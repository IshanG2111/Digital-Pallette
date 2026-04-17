export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface FrameData {
  timestamp: number;
  color: RGB;
  peaks: RGB;
  isSceneChange?: boolean;
}

/**
 * Calculates Euclidean distance between two RGB colors.
 * Returns a value between 0 and ~441.67 (sqrt(3 * 255^2)).
 */
export const calculateEuclideanDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    (c2.r - c1.r) ** 2 +
    (c2.g - c1.g) ** 2 +
    (c2.b - c1.b) ** 2
  );
};

/**
 * Applies color grading to raw pixel data in-place.
 * Uses the full palette for multi-color grading with luminance preservation.
 */
export function applyColorGrade(
  data: Uint8ClampedArray,
  paletteColors: [number, number, number][],
  intensity: number,
  contrast: number,
  saturation: number,
  temperature: number
): void {
  const intFact = intensity / 100;
  const contFact = 1 + contrast / 100;
  const satFact = 1 + saturation / 100;
  const tempFact = temperature / 100;

  // Pre-compute palette zone boundaries based on luminance bands
  const numColors = paletteColors.length;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Contrast: S-curve centered at 128
    r = clamp(((r / 255 - 0.5) * contFact + 0.5) * 255);
    g = clamp(((g / 255 - 0.5) * contFact + 0.5) * 255);
    b = clamp(((b / 255 - 0.5) * contFact + 0.5) * 255);

    // 2. Saturation: desaturate or saturate around luminance
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = clamp(luma + (r - luma) * satFact);
    g = clamp(luma + (g - luma) * satFact);
    b = clamp(luma + (b - luma) * satFact);

    // 3. Temperature: warm/cool shift
    if (tempFact !== 0) {
      r = clamp(r + tempFact * 30);
      b = clamp(b - tempFact * 30);
      g = clamp(g + tempFact * 8);
    }

    // 4. Palette color transfer: map luminance band → palette color
    if (numColors > 0 && intFact > 0) {
      const lumaNew = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedLuma = lumaNew / 255;
      // Pick palette color from luminance band (dark→light maps to palette index order)
      const idx = Math.min(numColors - 1, Math.floor(normalizedLuma * numColors));
      const pc = paletteColors[idx];

      // Luminance-preserving blend
      r = clamp(r * (1 - intFact) + (pc[0] * (lumaNew / 255)) * intFact);
      g = clamp(r * 0 + g * (1 - intFact) + (pc[1] * (lumaNew / 255)) * intFact);
      b = clamp(b * (1 - intFact) + (pc[2] * (lumaNew / 255)) * intFact);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
