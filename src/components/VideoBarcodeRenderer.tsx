"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FrameData,
  calculateEuclideanDistance,
  extractDominantColorsLAB,
} from "@/lib/colorEngine";
import VibeHistogram from "./VibeHistogram";
import {
  Play,
  Pause,
  Film,
  FastForward,
  Loader2,
  Pipette,
} from "lucide-react";

import { useUISound } from "@/hooks/useUISound";

import { Palette } from "@/types";

interface VideoBarcodeRendererProps {
  videoUrl: string;
  onExtractPalette?: (palette: Palette) => void;
}

const SCENE_CUT_THRESHOLD = 80;
const PROCESS_FPS = 4;

export default function VideoBarcodeRenderer({
  videoUrl,
  onExtractPalette,
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
  const { playScratch: playClick, playCrinkle: playSwoosh, playSlateClap: playPop } = useUISound();

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
        const next = [...prev, { timestamp, color, peaks, palette: e.data.palette, isSceneChange }];
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
          ctx.fillStyle = "rgba(255,255,255,0.8)";
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
    playClick();
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
    playSwoosh();
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
        playPop();
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
    playClick();
    const x = e.nativeEvent.offsetX;
    const ratio = x / e.currentTarget.clientWidth;
    if (videoRef.current) {
      videoRef.current.currentTime = ratio * videoRef.current.duration;
      // Extract palette from the closest frame in the barcode
      if (frames.length > 0 && onExtractPalette) {
        const frameIdx = Math.floor(ratio * frames.length);
        const f = frames[Math.min(frameIdx, frames.length - 1)];
        if (f && f.palette) {
          playPop();
          onExtractPalette({
            id: `scene-${Date.now()}`,
            name: `Scene ${fmt(f.timestamp)}`,
            colors: f.palette,
          });
        }
      }
    }
  };

  const extractCurrentFramePalette = () => {
    playSwoosh();
    const v = videoRef.current;
    if (!v || !onExtractPalette) return;

    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(v, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;

    const paletteColors = extractDominantColorsLAB(data, 5, 2000);

    onExtractPalette({
      id: `frame-${Date.now()}`,
      name: `Frame ${fmt(v.currentTime)}`,
      colors: paletteColors
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full w-full animate-fade-in p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
          <Film className="w-4 h-4" /> Cinema Engine
        </h2>
        <div className="flex items-center gap-2">
          {onExtractPalette && (
            <button
              onClick={extractCurrentFramePalette}
              disabled={isProcessing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-all border border-slate-200 ${
                isProcessing
                  ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                  : "bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              }`}
              title="Extract a palette from the currently visible frame"
            >
              <Pipette className="w-3.5 h-3.5 text-primary" />
              Extract Frame
            </button>
          )}
          <button
            onClick={autoExtract}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition-all border border-slate-200 ${
              isProcessing
                ? "bg-primary/5 text-primary cursor-wait"
                : "bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <FastForward className="w-3.5 h-3.5 text-primary" />
            )}
            {isProcessing ? "Extractingâ€¦" : "Auto-Extract"}
          </button>
        </div>
      </div>

      {/* Video player */}
      <div className="relative w-full bg-slate-900 rounded-xl overflow-hidden shadow-inner aspect-video group flex items-center justify-center">
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
            className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md shadow-lg text-slate-800 flex items-center justify-center hover:bg-white hover:scale-105 transition-all outline-none"
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
        <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden shadow-inner">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Barcode */}
      <div className="w-full flex flex-col gap-1.5 mt-2">
        <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">
          <span>00:00</span>
          <span>
            Master Barcode
            {frames.length > 0 && ` Â· ${frames.length} frames`}
          </span>
          <span>
            {videoRef.current ? fmt(videoRef.current.duration) : "--:--"}
          </span>
        </div>
        <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative cursor-crosshair group">
          <canvas
            ref={barcodeCanvasRef}
            width={1200}
            height={96}
            className="w-full h-full"
            style={{ imageRendering: "pixelated" }}
            onClick={seekTo}
          />
          {frames.length === 0 && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-50/80 backdrop-blur-sm">
              Click Auto-Extract or play the video
            </div>
          )}
          {frames.length > 0 && (
            <div className="absolute inset-0 border-[3px] border-transparent hover:border-primary/50 transition-colors pointer-events-none rounded-lg" />
          )}
        </div>
      </div>
    </div>
  );
}
