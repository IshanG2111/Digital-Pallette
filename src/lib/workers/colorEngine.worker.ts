// Web Worker for processing video frames and extracting dominant/average colors
// We don't import React here since it's a separate thread

self.onmessage = (e: MessageEvent) => {
  const { imageData, timestamp } = e.data;
  
  if (!imageData) return;

  const data = imageData.data;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  let peakR = 0, peakG = 0, peakB = 0; // Keeping track of peaks for vibe histograms

  // Simple average color extraction skipping a few pixels for performance
  const step = 4 * 4; // Sample every 4th pixel to save CPU
  
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignore fully transparent pixels
    if (a < 128) continue;

    rSum += r;
    gSum += g;
    bSum += b;
    count++;

    if (r > peakR) peakR = r;
    if (g > peakG) peakG = g;
    if (b > peakB) peakB = b;
  }

  const avgColors = count > 0 
    ? { r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count) }
    : { r: 0, g: 0, b: 0 };

  const result = {
    timestamp,
    color: avgColors,
    peaks: { r: peakR, g: peakG, b: peakB },
  };

  self.postMessage(result);
};

export {}; // Ensure it's treated as a module
