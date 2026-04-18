"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Palette, ControlState } from "@/types";
import { Maximize2, SplitSquareHorizontal, Loader2 } from "lucide-react";

interface CanvasRendererProps {
  imageUrl: string | null;
  palette: Palette | null;
  controls: ControlState;
}

export default function CanvasRenderer({
  imageUrl,
  palette,
  controls,
}: CanvasRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [workerReady, setWorkerReady] = useState(false);

  // Set up Worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../lib/workers/gradingEngine.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === "INIT_DONE") {
        setWorkerReady(true);
      } else if (type === "RENDER_DONE") {
        const outBmp = payload.imageBitmap;
        const pCtx = processedCanvasRef.current?.getContext("2d");
        if (pCtx && outBmp) {
          pCtx.clearRect(0, 0, processedCanvasRef.current!.width, processedCanvasRef.current!.height);
          pCtx.drawImage(outBmp, 0, 0);
        }
        setIsProcessing(false);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const fitAndInitWorker = useCallback(
    async (img: HTMLImageElement) => {
      const maxWidth = containerRef.current?.clientWidth || 800;
      const maxHeight = containerRef.current?.clientHeight || 600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);

      setDimensions({ width: w, height: h });

      // Draw original
      const ctxOrig = canvasRef.current?.getContext("2d");
      if (ctxOrig && canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        ctxOrig.drawImage(img, 0, 0, w, h);
      }
      
      if (processedCanvasRef.current) {
        processedCanvasRef.current.width = w;
        processedCanvasRef.current.height = h;
      }

      // Init worker with base ImageBitmap
      setWorkerReady(false);
      const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h });
      workerRef.current?.postMessage({ type: "INIT", payload: { imageBitmap: bmp } }, [bmp]);
    },
    []
  );

  // Load image when URL changes
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      fitAndInitWorker(img);
    };
  }, [imageUrl, fitAndInitWorker]);

  // Request Render when props change
  useEffect(() => {
    if (!workerReady || dimensions.width === 0) return;
    setIsProcessing(true);
    workerRef.current?.postMessage({
       type: "RENDER",
       payload: {
          palette: palette?.colors ?? [],
          controls: controls
       }
    });
  }, [palette, controls, dimensions.width, workerReady]);

  // Pointer handlers for before/after slider
  const handlePointerDown = () => setIsDragging(true);
  const handlePointerUp = () => setIsDragging(false);
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  // ── Empty state ──
  if (!imageUrl) {
    return (
      <div className="flex-1 w-full h-full min-h-[400px] glass-panel rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
        <Maximize2 className="w-10 h-10 mb-3 opacity-40 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">Upload media to start grading</p>
        <p className="text-xs text-slate-400 mt-1">
          The live preview will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full animate-fade-in p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 px-1">
        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
          <SplitSquareHorizontal className="w-3.5 h-3.5" /> Live Preview
        </h2>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          )}
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm">
            Before / After
          </span>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full rounded-lg overflow-hidden cursor-ew-resize flex items-center justify-center select-none bg-slate-100 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-slate-200/60"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
      >
        <div
          className="relative transition-opacity duration-300 shadow-md"
          style={{ width: dimensions.width, height: dimensions.height, opacity: dimensions.width > 0 ? 1 : 0 }}
        >
          {/* Original canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full"
          />

          {/* Processed canvas – clipped from right side */}
          <canvas
            ref={processedCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          />

          {/* Slider divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)] pointer-events-none z-10"
            style={{
              left: `${sliderPosition}%`,
              transform: "translateX(-50%)",
            }}
          >
            {/* Handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center border border-slate-100">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="8 18 4 12 8 6" />
                <polyline points="16 6 20 12 16 18" />
              </svg>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-bold text-slate-600 uppercase tracking-widest shadow-sm">
            Original
          </div>
          <div className="absolute bottom-3 right-3 bg-primary text-white backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest shadow-sm">
            Graded
          </div>
        </div>
      </div>
    </div>
  );
}
