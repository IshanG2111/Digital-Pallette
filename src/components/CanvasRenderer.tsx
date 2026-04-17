"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Palette, ControlState } from "@/types";
import { applyColorGrade } from "@/lib/colorEngine";
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

  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Stable refs for palette/controls so callbacks don't go stale
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const renderProcessed = useCallback(
    (img: HTMLImageElement, w: number, h: number) => {
      const ctx = processedCanvasRef.current?.getContext("2d");
      if (!ctx || !processedCanvasRef.current) return;

      setIsProcessing(true);

      processedCanvasRef.current.width = w;
      processedCanvasRef.current.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const paletteColors = paletteRef.current?.colors ?? [];
      const ctrl = controlsRef.current;

      applyColorGrade(
        imageData.data,
        paletteColors,
        ctrl.intensity,
        ctrl.contrast,
        ctrl.saturation,
        ctrl.temperature
      );

      ctx.putImageData(imageData, 0, 0);
      setIsProcessing(false);
    },
    []
  );

  const fitAndDraw = useCallback(
    (img: HTMLImageElement) => {
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

      renderProcessed(img, w, h);
    },
    [renderProcessed]
  );

  // Load image when URL changes
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      fitAndDraw(img);
    };
  }, [imageUrl, fitAndDraw]);

  // Re-grade when palette/controls change (without reloading image)
  useEffect(() => {
    const img = imgRef.current;
    if (img && dimensions.width > 0 && dimensions.height > 0) {
      renderProcessed(img, dimensions.width, dimensions.height);
    }
  }, [palette, controls, dimensions.width, dimensions.height, renderProcessed]);

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
      <div className="flex-1 w-full h-full min-h-[400px] glass-panel rounded-xl flex flex-col items-center justify-center text-white/30 border border-dashed border-white/[0.06]">
        <Maximize2 className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Upload media to start grading</p>
        <p className="text-xs text-white/20 mt-1">
          The live preview will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
          <SplitSquareHorizontal className="w-4 h-4" /> Live Preview
        </h2>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          )}
          <span className="text-[11px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
            Before / After
          </span>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full glass-panel rounded-xl overflow-hidden cursor-ew-resize flex items-center justify-center select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
      >
        <div
          className="relative"
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Original canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full rounded-md"
          />

          {/* Processed canvas – clipped from right side */}
          <canvas
            ref={processedCanvasRef}
            className="absolute top-0 left-0 w-full h-full rounded-md pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          />

          {/* Slider divider */}
          <div
            className="absolute top-0 bottom-0 w-px bg-white/70 pointer-events-none z-10"
            style={{
              left: `${sliderPosition}%`,
              transform: "translateX(-50%)",
            }}
          >
            {/* Handle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111"
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
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white/70 uppercase tracking-wider">
            Original
          </div>
          <div className="absolute bottom-3 right-3 bg-primary/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white/90 uppercase tracking-wider">
            Graded
          </div>
        </div>
      </div>
    </div>
  );
}
