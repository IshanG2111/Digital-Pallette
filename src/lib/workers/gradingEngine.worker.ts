import { applyColorGrade } from "../colorEngine";

const workerCtx: Worker = self as any;

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let baseImageData: ImageData | null = null;

workerCtx.onmessage = async function (e: MessageEvent) {
  const { type, payload } = e.data;

  if (type === "INIT") {
    const bmp = payload.imageBitmap as ImageBitmap;
    offscreenCanvas = new OffscreenCanvas(bmp.width, bmp.height);
    ctx = offscreenCanvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
    
    ctx.drawImage(bmp, 0, 0);
    // Cache the base image data
    baseImageData = ctx.getImageData(0, 0, bmp.width, bmp.height);
    
    workerCtx.postMessage({ type: "INIT_DONE" });
  }

  if (type === "RENDER") {
    if (!ctx || !baseImageData || !offscreenCanvas) return;

    // We must clone the base pixel values so we apply from neutral every frame
    const gradedData = new ImageData(
      new Uint8ClampedArray(baseImageData.data),
      baseImageData.width,
      baseImageData.height
    );

    // Run the high performance Luma grading math
    applyColorGrade(gradedData.data, payload.palette, payload.controls);

    // Paint to the offscreen canvas
    ctx.putImageData(gradedData, 0, 0);

    // Convert to ImageBitmap and transfer back (zero-copy)
    const outBmp = await createImageBitmap(offscreenCanvas);
    workerCtx.postMessage({ type: "RENDER_DONE", payload: { imageBitmap: outBmp } }, [outBmp]);
  }
};
