import { ControlState } from "@/types";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface FrameData {
  timestamp: number;
  color: RGB;
  peaks: RGB;
  palette: [number, number, number][];
  isSceneChange?: boolean;
}

/**
 * Calculates Euclidean distance between two RGB colors.
 */
export const calculateEuclideanDistance = (c1: RGB, c2: RGB): number => {
  return Math.sqrt(
    (c2.r - c1.r) ** 2 +
    (c2.g - c1.g) ** 2 +
    (c2.b - c1.b) ** 2
  );
};

export function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Applies color grading to raw pixel data in-place.
 */
export function applyColorGrade(
  data: Uint8ClampedArray,
  paletteColors: [number, number, number][],
  controls: ControlState
): void {
  const intFact = controls.intensity / 100;
  const contFact = 1 + controls.contrast / 100;
  const satFact = 1 + controls.saturation / 100;
  const tempFact = controls.temperature / 100;
  
  // New Lightroom-style controls
  const expFact = controls.exposure / 100;
  const highFact = controls.highlights / 100;
  const shadFact = controls.shadows / 100;
  const tintFact = controls.tint / 100;
  const vibFact = controls.vibrance / 100;
  const skinProtect = controls.skinToneProtection;

  const numColors = paletteColors.length;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const initialLuma = 0.299 * r + 0.587 * g + 0.114 * b;
    let skinMask = 1;

    // Skin Tone Mask (Hue roughly between orange and red, sat not too low)
    if (skinProtect) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && (maxC - minC) > 15 && Math.abs(r - g) > 15 && r > g && r > b) {
        // Falls roughly in skin tone zone. Soft mask.
        skinMask = 0.3; // Reduces effect by 70%
      }
    }

    // 1. Exposure
    r = clamp(r * Math.pow(2, expFact));
    g = clamp(g * Math.pow(2, expFact));
    b = clamp(b * Math.pow(2, expFact));

    // 2. Contrast
    r = clamp(((r / 255 - 0.5) * contFact + 0.5) * 255);
    g = clamp(((g / 255 - 0.5) * contFact + 0.5) * 255);
    b = clamp(((b / 255 - 0.5) * contFact + 0.5) * 255);

    // 3. Highlights & Shadows (using luma mask)
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const highlightMask = Math.max(0, (luma - 128) / 127);
    const shadowMask = Math.max(0, (127 - luma) / 127);
    
    // Scale up/down based on mask
    const hMult = 1 + (highFact * highlightMask);
    const sMult = 1 + (shadFact * shadowMask);
    
    r = clamp(r * hMult * sMult);
    g = clamp(g * hMult * sMult);
    b = clamp(b * hMult * sMult);

    // 4. White Balance (Temp & Tint)
    r = clamp(r + tempFact * 30 + tintFact * 15);
    b = clamp(b - tempFact * 30);
    g = clamp(g + tempFact * 8 - tintFact * 15);

    // 5. Saturation & Vibrance
    const newLuma = 0.299 * r + 0.587 * g + 0.114 * b;
    let currentVibrance = vibFact;
    
    // Vibrance applies less to already saturated pixels
    if (vibFact !== 0) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      currentVibrance = vibFact * (1 - sat); // Less effect on saturated pixels
    }

    const totalSat = satFact + currentVibrance;
    r = clamp(newLuma + (r - newLuma) * totalSat);
    g = clamp(newLuma + (g - newLuma) * totalSat);
    b = clamp(newLuma + (b - newLuma) * totalSat);

    // 6. Palette Color Transfer (Mapping)
    if (numColors > 0 && intFact > 0) {
      const pLuma = 0.299 * r + 0.587 * g + 0.114 * b;
      const normalizedLuma = pLuma / 255;
      const idx = Math.min(numColors - 1, Math.floor(normalizedLuma * numColors));
      const pc = paletteColors[idx];

      const applyStr = intFact * skinMask;
      r = clamp(r * (1 - applyStr) + (pc[0] * (pLuma / 255)) * applyStr);
      g = clamp(r * 0 + g * (1 - applyStr) + (pc[1] * (pLuma / 255)) * applyStr);
      b = clamp(b * (1 - applyStr) + (pc[2] * (pLuma / 255)) * applyStr);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/**
 * Generates a 3D LUT string in .CUBE format.
 */
export function generateCubeLUT(paletteColors: [number, number, number][], controls: ControlState, size = 32): string {
  let lut = `TITLE "DirectorsPalette_LUT"\nLUT_3D_SIZE ${size}\n\n`;
  const data = new Uint8ClampedArray(4);

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        data[0] = Math.round((r / (size - 1)) * 255);
        data[1] = Math.round((g / (size - 1)) * 255);
        data[2] = Math.round((b / (size - 1)) * 255);
        data[3] = 255;

        applyColorGrade(data, paletteColors, controls);

        lut += `${(data[0]/255).toFixed(6)} ${(data[1]/255).toFixed(6)} ${(data[2]/255).toFixed(6)}\n`;
      }
    }
  }

  return lut;
}

/**
 * Computes per-channel mean and standard deviation from pixel data.
 * Used for Histogram Matching (palette DNA transfer).
 */
export interface ChannelStats {
  rMean: number; rStd: number;
  gMean: number; gStd: number;
  bMean: number; bStd: number;
}

export function computeChannelStats(data: Uint8ClampedArray): ChannelStats {
  const n = data.length / 4;
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
  }
  const rMean = rSum / n;
  const gMean = gSum / n;
  const bMean = bSum / n;

  let rVar = 0, gVar = 0, bVar = 0;
  for (let i = 0; i < data.length; i += 4) {
    rVar += (data[i]     - rMean) ** 2;
    gVar += (data[i + 1] - gMean) ** 2;
    bVar += (data[i + 2] - bMean) ** 2;
  }
  return {
    rMean, rStd: Math.sqrt(rVar / n),
    gMean, gStd: Math.sqrt(gVar / n),
    bMean, bStd: Math.sqrt(bVar / n),
  };
}

