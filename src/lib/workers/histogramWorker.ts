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

  let rVar = 0, gVar = 0, bVar = 0;
  for (let i = 0; i < data.length; i += 4) {
    rVar += (data[i]     - rMean) ** 2;
    gVar += (data[i + 1] - gMean) ** 2;
    bVar += (data[i + 2] - bMean) ** 2;
  }

  const result: ChannelStats = {
    rMean, rStd: Math.sqrt(rVar / n),
    gMean, gStd: Math.sqrt(gVar / n),
    bMean, bStd: Math.sqrt(bVar / n),
  };

  ctx.postMessage(result);
};
