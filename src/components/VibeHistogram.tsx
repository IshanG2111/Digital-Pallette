"use client";

import React, { useEffect, useRef } from "react";
import { FrameData } from "@/lib/colorEngine";

interface VibeHistogramProps {
  frames: FrameData[];
}

export default function VibeHistogram({ frames }: VibeHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (frames.length === 0) return;

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const maxFrames = Math.max(100, frames.length);
    const stepX = w / maxFrames;

    const drawLine = (
      attr: "r" | "g" | "b",
      color: string
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      for (let i = 0; i < frames.length; i++) {
        const val = frames[i].peaks[attr];
        const x = i * stepX;
        const y = h - (val / 255) * h;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = (i - 1) * stepX;
          const cpX = (prevX + x) / 2;
          const prevY =
            h - (frames[i - 1].peaks[attr] / 255) * h;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      }
      ctx.stroke();
    };

    ctx.globalCompositeOperation = "screen";
    drawLine("r", "rgba(255,60,60,0.7)");
    drawLine("g", "rgba(60,255,60,0.7)");
    drawLine("b", "rgba(60,120,255,0.7)");
    ctx.globalCompositeOperation = "source-over";

    // Scene cut markers
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    frames.forEach((f, i) => {
      if (f.isSceneChange) {
        const x = i * stepX;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
  }, [frames]);

  return (
    <div className="w-full flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-white/30 px-1">
        RGB Intensity
      </span>
      <div className="w-full h-14 rounded-lg overflow-hidden glass-panel border border-white/[0.04] relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={56}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />
        {frames.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/20">
            Awaiting frames…
          </div>
        )}
      </div>
    </div>
  );
}
