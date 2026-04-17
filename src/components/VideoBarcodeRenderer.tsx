"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FrameData,
  calculateEuclideanDistance,
} from "@/lib/colorEngine";
import VibeHistogram from "./VibeHistogram";
import {
  Play,
  Pause,
  Film,
  FastForward,
  Loader2,
} from "lucide-react";

interface VideoBarcodeRendererProps {
  videoUrl: string;
}

const SCENE_CUT_THRESHOLD = 80;
const PROCESS_FPS = 4;

export default function VideoBarcodeRenderer({
  videoUrl,
}: VideoBarcodeRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTimeRef = useRef(-1);
  const processingRef = useRef(false);

  // Helper: format time
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Init worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("@/lib/workers/colorEngine.worker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { timestamp, color, peaks } = e.data;
      setFrames((prev) => {
        let isSceneChange = false;
        if (prev.length > 0) {
          const dist = calculateEuclideanDistance(
            prev[prev.length - 1].color,
            color
          );
          if (dist > SCENE_CUT_THRESHOLD) isSceneChange = true;
        }
        const next = [...prev, { timestamp, color, peaks, isSceneChange }];
        paintBarcode(next);
        return next;
      });
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Paint barcode canvas
  const paintBarcode = useCallback(
    (data: FrameData[]) => {
      const canvas = barcodeCanvasRef.current;
      if (!canvas || data.length === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const dur = videoRef.current?.duration || 1;
      const expected = Math.max(
        Math.floor(dur * PROCESS_FPS),
        data.length,
        60
      );
      const sw = Math.max(1, w / expected);

      data.forEach((f, i) => {
        const x = i * sw;
        ctx.fillStyle = `rgb(${f.color.r},${f.color.g},${f.color.b})`;
        ctx.fillRect(x, 0, Math.ceil(sw) + 0.5, h);
        if (f.isSceneChange) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(x, 0, 1, h);
        }
      });
    },
    []
  );

  // Extract one frame
  const processFrame = useCallback(() => {
    const v = videoRef.current;
    const c = hiddenCanvasRef.current;
    const w = workerRef.current;
    if (!v || !c || !w) return;

    const t = v.currentTime;
    if (Math.abs(t - lastTimeRef.current) < 1 / PROCESS_FPS) return;
    lastTimeRef.current = t;

    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const pw = 320;
    const ph = 180;
    c.width = pw;
    c.height = ph;
    ctx.drawImage(v, 0, 0, pw, ph);
    w.postMessage({
      imageData: ctx.getImageData(0, 0, pw, ph),
      timestamp: t,
    });
  }, []);

  // rAF loop
  useEffect(() => {
    let raf: number;
    const loop = () => {
      if (
        isPlaying &&
        !videoRef.current?.paused &&
        !videoRef.current?.ended
      ) {
        processFrame();
        raf = requestAnimationFrame(loop);
      }
    };
    if (isPlaying) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, processFrame]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // Auto-extract
  const autoExtract = () => {
    const v = videoRef.current;
    if (!v || processingRef.current) return;

    v.pause();
    setIsPlaying(false);
    setFrames([]);
    lastTimeRef.current = -1;
    setIsProcessing(true);
    setProgress(0);
    processingRef.current = true;
    v.muted = true;

    const dur = v.duration;
    const step = 1 / PROCESS_FPS;
    let t = 0;

    const advance = () => {
      if (t > dur || !processingRef.current) {
        setIsProcessing(false);
        processingRef.current = false;
        v.currentTime = 0;
        return;
      }
      v.currentTime = t;
    };

    const onSeeked = () => {
      if (!processingRef.current) return;
      processFrame();
      t += step;
      setProgress(Math.min(100, (t / dur) * 100));
      setTimeout(advance, 20);
    };

    v.addEventListener("seeked", onSeeked);
    advance();

    // Store cleanup
    const cleanup = () => {
      v.removeEventListener("seeked", onSeeked);
      processingRef.current = false;
    };

    // cleanup on unmount via a tiny timeout trick
    return cleanup;
  };

  const seekTo = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.nativeEvent.offsetX;
    const ratio = x / e.currentTarget.clientWidth;
    if (videoRef.current) {
      videoRef.current.currentTime = ratio * videoRef.current.duration;
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
          <Film className="w-4 h-4" /> Cinema Engine
        </h2>
        <button
          onClick={autoExtract}
          disabled={isProcessing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            isProcessing
              ? "bg-primary/15 text-primary border border-primary/20 cursor-wait"
              : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/[0.06]"
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FastForward className="w-3.5 h-3.5" />
          )}
          {isProcessing ? "Extracting…" : "Auto-Extract"}
        </button>
      </div>

      {/* Video player */}
      <div className="relative w-full bg-black/30 glass-panel rounded-xl overflow-hidden aspect-video group flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          controls={false}
          className="w-full h-full object-contain"
          onEnded={() => setIsPlaying(false)}
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Hidden canvas */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      {/* Progress bar (during auto-extract) */}
      {isProcessing && (
        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Barcode */}
      <div className="w-full flex flex-col gap-1.5">
        <div className="flex justify-between text-[10px] font-mono text-white/30 px-0.5 uppercase tracking-wider">
          <span>00:00</span>
          <span>
            Master Barcode
            {frames.length > 0 && ` · ${frames.length} frames`}
          </span>
          <span>
            {videoRef.current ? fmt(videoRef.current.duration) : "--:--"}
          </span>
        </div>
        <div className="w-full h-24 rounded-lg overflow-hidden glass-panel border border-white/[0.04] relative cursor-pointer">
          <canvas
            ref={barcodeCanvasRef}
            width={1200}
            height={96}
            className="w-full h-full"
            style={{ imageRendering: "pixelated" }}
            onClick={seekTo}
          />
          {frames.length === 0 && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/20">
              Click Auto-Extract or play the video
            </div>
          )}
        </div>
      </div>

      {/* Histogram */}
      <VibeHistogram frames={frames} />
    </div>
  );
}
