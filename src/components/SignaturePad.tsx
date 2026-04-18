"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface SignaturePadProps {
  onSign: (dataUrl: string) => void;
  width?: number;
  height?: number;
}

/**
 * Director's Signature Pad — a tiny canvas where the user
 * can "sign" the bottom of their final grade before export.
 */
export default function SignaturePad({ onSign, width = 300, height = 80 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Paper texture background
    ctx.fillStyle = "#fbf7ef";
    ctx.fillRect(0, 0, width, height);

    // "Sign here" line
    ctx.strokeStyle = "#d4c9b5";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(20, height - 20);
    ctx.lineTo(width - 20, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [width, height]);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    };
  };

  const handleDown = (e: React.PointerEvent) => {
    setIsDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = "#2c2418";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleUp = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSign(canvasRef.current.toDataURL("image/png"));
    }
  };

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fbf7ef";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#d4c9b5";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(20, height - 20);
    ctx.lineTo(width - 20, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    setHasDrawn(false);
  }, [width, height]);

  return (
    <div className="flex flex-col gap-2 items-center">
      <p className="hand-label text-sm" style={{ transform: "rotate(-1.5deg)" }}>
        Director&apos;s Signature
      </p>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="crayon-border cursor-crosshair touch-none"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
      {hasDrawn && (
        <button
          onClick={handleClear}
          className="text-xs font-hand text-muted hover:text-foreground transition-colors"
        >
          Clear Signature
        </button>
      )}
    </div>
  );
}
