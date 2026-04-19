/**
 * Histogram Analysis Worker
 * Computes per-channel mean and standard deviation for palette matching.
 * Posted message format: { imageData: ImageData }
 * Response format: { rMean, rStd, gMean, gStd, bMean, bStd }
 */

export interface ChannelStats {
  rMean: number; rStd: number;
  gMean: number; gStd: number;
  bMean: number; bStd: number;
  mean: [number, number, number];
  cov: [number, number, number, number, number, number, number, number, number];
}

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = function (e: MessageEvent) {
  const { imageData } = e.data as { imageData: ImageData };
  const data = imageData.data;
  const n = data.length / 4;

  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const rMean = rSum / n;
  const gMean = gSum / n;
  const bMean = bSum / n;

  let c00=0, c01=0, c02=0;
  let c11=0, c12=0;
  let c22=0;

  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - rMean;
    const dg = data[i + 1] - gMean;
    const db = data[i + 2] - bMean;
    c00 += dr * dr; c01 += dr * dg; c02 += dr * db;
    c11 += dg * dg; c12 += dg * db;
    c22 += db * db;
  }

  const result: ChannelStats = {
    rMean, rStd: Math.sqrt(c00 / n),
    gMean, gStd: Math.sqrt(c11 / n),
    bMean, bStd: Math.sqrt(c22 / n),
    mean: [rMean, gMean, bMean],
    cov: [
      c00/n, c01/n, c02/n,
      c01/n, c11/n, c12/n,
      c02/n, c12/n, c22/n
    ]
  };

  ctx.postMessage(result);
};
