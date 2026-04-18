"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaUploader from "@/components/ImageUploader";
import PaletteSelector from "@/components/PaletteSelector";
import WebGLRenderer from "@/components/WebGLRenderer";
import VideoBarcodeRenderer from "@/components/VideoBarcodeRenderer";
import ControlPanel from "@/components/ControlPanel";
import SmpteLoader from "@/components/SmpteLoader";
import ChalkLoader from "@/components/ChalkLoader";
import SignaturePad from "@/components/SignaturePad";
import StudioOpener from "@/components/StudioOpener";
import FramedImage, { FrameType } from "@/components/FramedImage";
import {
  Palette,
  ControlState,
  DEFAULT_CONTROLS,
  MediaType,
  RGB,
} from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";
import { generateCubeLUT, computeChannelStats, ChannelStats } from "@/lib/colorEngine";
import { useUISound } from "@/hooks/useUISound";
import {
  ChevronRight,
  ChevronUp,
  ArrowLeft,
  Wand2,
  Download,
  Aperture,
  Camera,
  X,
  RotateCcw,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const ACTS = [
  { num: 1, label: "Ingest",   subtitle: "The Empty Studio" },
  { num: 2, label: "Alchemy",  subtitle: "DNA Scan" },
  { num: 3, label: "Darkroom", subtitle: "The Workstation" },
  { num: 4, label: "Master",   subtitle: "The Final Cut" },
];

const springStiff  = { type: "spring" as const, stiffness: 300, damping: 30 };
const springGentle = { type: "spring" as const, stiffness: 200, damping: 25 };

export default function Home() {
  /* ── Opening Sequence ─────────────────────────────────────────────────── */
  const [showOpener, setShowOpener] = useState(true);

  /* ── Act flow ─────────────────────────────────────────────────────────── */
  const [act, setAct] = useState(1);
  const [filmBurnKey, setFilmBurnKey] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [showNegative, setShowNegative] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [frameType, setFrameType] = useState<FrameType>("none");
  const { playCrinkle, playSlateClap, playScratch, playShutter, playProjectorHum } = useUISound();

  /* ── Extraction ───────────────────────────────────────────────────────── */
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionDone, setExtractionDone] = useState(false);
  const [sourceDNA, setSourceDNA] = useState<RGB[] | null>(null);

  /* ── Media ─────────────────────────────────────────────────────────────── */
  const [sourceMediaUrl, setSourceMediaUrl] = useState<string | null>(null);
  const [targetMediaUrl, setTargetMediaUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<MediaType>(null);
  const [sourceThumb, setSourceThumb] = useState<string | null>(null);

  /* ── Grading ───────────────────────────────────────────────────────────── */
  const [selectedPalette, setSelectedPalette] = useState<Palette>(PRESET_PALETTES[0]);
  const [controls, setControls] = useState<ControlState>({ ...DEFAULT_CONTROLS });
  const [sourceStats, setSourceStats] = useState<ChannelStats | null>(null);

  /* ── Export ─────────────────────────────────────────────────────────────── */
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const signatureRef = useRef<string | null>(null);

  /* ═══════════════════════════════════════════════════════════════════════
     FILM BURN TRANSITION
     ═══════════════════════════════════════════════════════════════════════ */
  const fireFilmBurn = () => setFilmBurnKey(k => k + 1);

  const transitionTo = (n: number) => {
    fireFilmBurn();
    setTimeout(() => setAct(n), 280);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     HANDLERS
     ═══════════════════════════════════════════════════════════════════════ */

  /* ACT 1 → 2: Source upload ──────────────────────────────────────────── */
  const handleSourceUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setSourceMediaUrl(url);
    const isVideo = file.type.startsWith("video/");
    setSourceType(isVideo ? "video" : "image");

    playSlateClap();

    if (!isVideo) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = Math.min(img.naturalWidth, 256);
        c.height = Math.min(img.naturalHeight, 256);
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const stats = computeChannelStats(imgData.data);
        setSourceStats(stats);
        setSourceThumb(c.toDataURL("image/jpeg", 0.6));

        // Extract quick dominant colors from image data (simplified K-means)
        const extracted = extractDominantColors(imgData.data, 5);
        setSourceDNA(extracted);
      };
    }

    fireFilmBurn();
    setTimeout(() => {
      setExtractionProgress(0);
      setExtractionDone(false);
      setAct(2);
      playProjectorHum();
    }, 400);
  }, [playSlateClap, playProjectorHum]);

  /* Simplified dominant color extraction ──────────────────────────────── */
  function extractDominantColors(data: Uint8ClampedArray, k: number): RGB[] {
    // Sample pixels uniformly
    const samples: RGB[] = [];
    const step = Math.max(1, Math.floor(data.length / 4 / 500));
    for (let i = 0; i < data.length; i += step * 4) {
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
    // Simple bucket quantization (fast approximation of K-means)
    const buckets: Map<string, { sum: RGB; count: number }> = new Map();
    for (const s of samples) {
      const key = `${Math.round(s[0] / 32)}_${Math.round(s[1] / 32)}_${Math.round(s[2] / 32)}`;
      const b = buckets.get(key) || { sum: [0, 0, 0] as RGB, count: 0 };
      b.sum = [b.sum[0] + s[0], b.sum[1] + s[1], b.sum[2] + s[2]];
      b.count++;
      buckets.set(key, b);
    }
    const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
    return sorted.slice(0, k).map(b => [
      Math.round(b.sum[0] / b.count),
      Math.round(b.sum[1] / b.count),
      Math.round(b.sum[2] / b.count),
    ] as RGB);
  }

  /* ACT 2: Extraction progress ────────────────────────────────────────── */
  useEffect(() => {
    if (act !== 2 || extractionDone) return;
    const interval = setInterval(() => {
      setExtractionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setExtractionDone(true);
          playCrinkle();
          return 100;
        }
        return prev + Math.random() * 10 + 3;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [act, extractionDone, playCrinkle]);

  /* ACT 3: Target upload ──────────────────────────────────────────────── */
  const handleTargetUpload = useCallback((file: File) => {
    setTargetMediaUrl(URL.createObjectURL(file));
    playCrinkle();
  }, [playCrinkle]);

  /* Controls ──────────────────────────────────────────────────────────── */
  const handleControlChange = useCallback((key: keyof ControlState, value: number | boolean) => {
    setControls(prev => ({ ...prev, [key]: value }));
    setExported(false);
  }, []);

  const handleReset = useCallback(() => {
    setControls({ ...DEFAULT_CONTROLS });
    setExported(false);
    playScratch();
  }, [playScratch]);

  const handleSelectPalette = useCallback((p: Palette) => {
    setSelectedPalette(p);
    setExported(false);
  }, []);

  const handleMagicMatch = () => {
    playScratch();
    setControls(prev => ({
      ...prev,
      intensity: 75, exposure: 5, contrast: 12,
      highlights: -8, shadows: 8, saturation: 5, vibrance: 18,
    }));
  };

  /* Export ─────────────────────────────────────────────────────────────── */
  const handleExportLUT = useCallback(() => {
    playShutter();
    const lutStr = generateCubeLUT(selectedPalette.colors, controls, 32);
    const blob = new Blob([lutStr], { type: "text/plain" });
    const a = document.createElement("a");
    a.download = `Directors_Palette_${Date.now()}.cube`;
    a.href = URL.createObjectURL(blob);
    a.click();
  }, [selectedPalette, controls, playShutter]);

  const handleExport = useCallback(() => {
    const canvas = document.querySelector("#canvas-stage canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    setExporting(true);
    setShowFlash(true);
    playShutter();
    setTimeout(() => { setShowFlash(false); setShowNegative(true); }, 150);
    setTimeout(() => setShowNegative(false), 400);
    setTimeout(() => {
      const a = document.createElement("a");
      a.download = `directors_palette_${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      setExporting(false);
      setExported(true);
    }, 550);
  }, [playShutter]);

  /* Navigation ────────────────────────────────────────────────────────── */
  const goTo = (n: number) => {
    if (n >= 1 && n <= 4 && n <= act) transitionTo(n);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <main className="h-screen w-full flex flex-col overflow-hidden text-foreground relative z-0" style={{ background: "var(--background)" }}>
        <AnimatePresence>
          {showOpener && <StudioOpener onComplete={() => setShowOpener(false)} />}
        </AnimatePresence>

        {/* ── Global Overlays ─────────────────────────────────────────── */}
        {showFlash && (
          <div className="absolute inset-0 z-[200] bg-white animate-shutter pointer-events-none" />
        )}
        {showNegative && (
          <div className="absolute inset-0 z-[199] animate-negative-flash pointer-events-none" />
        )}
        {/* Film Burn Wipe */}
        <AnimatePresence>
          <div key={filmBurnKey} className="absolute inset-0 z-[150] pointer-events-none animate-film-burn" />
        </AnimatePresence>

        {/* ═══════════ HEADER ═══════════ */}
        <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 md:px-8 z-50" style={{
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border)",
        }}>
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0"
                style={{ borderColor: "#d4a853", background: "rgba(212,168,83,0.1)" }}>
                <Aperture className="w-3 h-3" style={{ color: "#d4a853" }} />
              </div>
              <span className="text-[11px] font-medium tracking-[0.2em] uppercase hidden md:block" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>
                Director&apos;s Palette
              </span>
            </div>

            {/* Separator */}
            <div className="w-px h-4 hidden md:block" style={{ background: "var(--border)" }} />

            {/* Step nav */}
            <nav className="flex items-center gap-1">
              {ACTS.map((a, i) => (
                <React.Fragment key={a.num}>
                  <button
                    onClick={() => goTo(a.num)}
                    disabled={a.num > act}
                    className={`relative px-3 py-1.5 text-[10px] tracking-[0.1em] uppercase transition-all rounded-sm ${
                      act === a.num
                        ? "text-foreground"
                        : a.num < act
                        ? "text-muted cursor-pointer hover:text-foreground"
                        : "text-border cursor-not-allowed"
                    }`}
                    style={{ fontFamily: "monospace" }}
                  >
                    {act === a.num && (
                      <span className="absolute inset-0 rounded-sm" style={{ background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)" }} />
                    )}
                    <span className="relative">{a.label}</span>
                  </button>
                  {i < 3 && <span className="text-[9px]" style={{ color: "var(--border)" }}>›</span>}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Contextual actions */}
          <div className="flex items-center gap-2">
            {act > 1 && (
              <button onClick={() => goTo(act - 1)} className="tape-btn tape-btn-small">
                <ArrowLeft className="w-3 h-3" /> <span className="hidden md:inline">Back</span>
              </button>
            )}
            {act === 2 && extractionDone && (
              <button onClick={() => transitionTo(3)} className="tape-btn btn-primary">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {act === 3 && targetMediaUrl && (
              <button onClick={() => transitionTo(4)} className="tape-btn btn-primary">
                Continue <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {act === 4 && (
              <div className="flex gap-2">
                <button onClick={() => transitionTo(3)} className="tape-btn tape-btn-small">
                  <RotateCcw className="w-3 h-3" /> <span className="hidden md:inline">Re-Edit</span>
                </button>
                <button
                  onClick={handleExport}
                  disabled={!targetMediaUrl || exporting}
                  className={`tape-btn btn-primary`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {exporting ? "Processing…" : exported ? "Exported ✓" : "Export"}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ═══════════ MAIN STAGE ═══════════ */}
        <div className="flex-1 min-h-0 relative" style={{ background: "var(--background)" }}>
          <AnimatePresence mode="wait">

                      {/* ──────────── ACT 1: THE INGEST ──────────── */}
            {act === 1 && (
              <motion.div
                key="act1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 flex items-center justify-center p-6 md:p-16"
              >
                <div className="w-full max-w-2xl flex flex-col items-center gap-6">
                  {/* Title */}
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                  >
                    <h1 className="text-2xl md:text-3xl font-light tracking-[0.15em] uppercase mb-2" style={{
                      fontFamily: "var(--font-mono), monospace",
                      color: "var(--foreground)"
                    }}>
                      Import Source
                    </h1>
                    <p className="text-[11px] tracking-widest" style={{
                      fontFamily: "monospace",
                      color: "var(--text-secondary)"
                    }}>
                      Drop a hero video or image to begin color grading
                    </p>
                  </motion.div>

                  {/* Drop Zone */}
                  <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full"
                    style={{ height: "360px" }}
                  >
                    <MediaUploader
                      onUpload={handleSourceUpload}
                      onClear={() => { setSourceMediaUrl(null); setSourceType(null); }}
                      currentMediaUrl={sourceMediaUrl}
                      mediaType={sourceType}
                    />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ──────────── ACT 2: THE ALCHEMY ──────────── */}
            {act === 2 && (
              <motion.div
                key="act2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={springStiff}
                className="absolute inset-0 flex flex-col md:flex-row p-4 md:p-8 gap-4 md:gap-8"
              >
                {/* Left: Source (60% — the hero frame) */}
                <div className="flex-[7] min-h-0 flex flex-col gap-2">
                  <h2 className="hand-label text-sm flex items-center gap-2">
                    Source — DNA Scan
                    {!extractionDone && (
                      <span className="text-[9px] text-muted animate-pulse">scanning...</span>
                    )}
                  </h2>
                  <div className="sketch-panel flex-1 overflow-hidden p-2 relative">
                    {/* Scanning overlay */}
                    {!extractionDone && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-sm border border-border">
                        <ChalkLoader
                          progress={Math.min(extractionProgress, 100)}
                          message="ANALYZING CHALK DUST..."
                        />
                      </div>
                    )}
                    {/* Charcoal scan line */}
                    {!extractionDone && (
                      <div
                        className="absolute left-0 right-0 h-[2px] bg-charcoal z-30 pointer-events-none"
                        style={{
                          top: `${Math.min(extractionProgress, 100)}%`,
                          boxShadow: "0 0 8px rgba(44,36,24,0.4)",
                          transition: "top 0.15s linear",
                        }}
                      />
                    )}
                    {sourceType === "video" && sourceMediaUrl ? (
                      <VideoBarcodeRenderer videoUrl={sourceMediaUrl} onExtractPalette={handleSelectPalette} />
                    ) : sourceMediaUrl ? (
                      <img src={sourceMediaUrl} alt="Source" className="w-full h-full object-contain rounded-sm" />
                    ) : (
                      <SmpteLoader message="No source" />
                    )}
                  </div>
                </div>

                {/* Right: Palette output (40%) */}
                <motion.div
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: extractionDone ? 1 : 0.3 }}
                  transition={{ delay: 0.15, ...springGentle }}
                  className="flex-[5] min-h-0 flex flex-col gap-3 overflow-y-auto no-scrollbar"
                >
                  {/* Extracted DNA strip */}
                  {extractionDone && sourceDNA && (
                    <motion.div
                      initial={{ y: 15, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="flex-shrink-0"
                    >
                      <h3 className="hand-label text-[10px] font-bold text-foreground tracking-[0.15em] mb-1.5 uppercase">
                        ★ EXTRACTED DNA
                      </h3>
                      <div className="flex h-10 rounded-sm overflow-hidden border-2 border-charcoal shadow-md"
                        style={{ boxShadow: "0 0 12px rgba(197,165,90,0.2)" }}
                      >
                        {sourceDNA.map((c, i) => (
                          <div key={i} className="flex-1 h-full" style={{ backgroundColor: `rgb(${c.join(",")})` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <PaletteSelector
                    selectedPaletteId={selectedPalette.id}
                    onSelectPalette={handleSelectPalette}
                    sourceDNA={sourceDNA}
                  />
                </motion.div>
              </motion.div>
            )}

                        {/* ──────────── ACT 3: THE DARKROOM ──────────── */}
            {act === 3 && (
              <motion.div
                key="act3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col"
              >
                {/* Fullscreen viewport */}
                <div className="flex-1 relative overflow-hidden" id="canvas-stage">
                  {targetMediaUrl ? (
                    <WebGLRenderer
                      imageUrl={targetMediaUrl}
                      palette={selectedPalette}
                      controls={controls}
                      sourceStats={sourceStats}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Target drop zone — centered, clean */}
                      <div className="flex flex-col items-center gap-4">
                        <div style={{ width: 400, height: 280 }}>
                          <MediaUploader
                            onUpload={handleTargetUpload}
                            onClear={() => setTargetMediaUrl(null)}
                            currentMediaUrl={targetMediaUrl}
                            mediaType="image"
                          />
                        </div>
                        <p className="text-[11px] tracking-[0.15em] uppercase" style={{ fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                          Drop the image you want to grade
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Bottom toolbar — floating panel toggles */}
                {targetMediaUrl && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex-shrink-0 flex items-center justify-between px-4 py-2"
                    style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)" }}
                  >
                    {/* Left: palette toggle */}
                    <button
                      onClick={() => { setPaletteOpen(o => !o); setAdjustOpen(false); }}
                      className={`tape-btn tape-btn-small gap-2 ${paletteOpen ? "btn-primary" : ""}`}
                    >
                      <Aperture className="w-3.5 h-3.5" />
                      Palettes
                    </button>

                    {/* Center: magic match */}
                    <button onClick={handleMagicMatch} className="tape-btn gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" /> Magic Match
                    </button>

                    {/* Right: adjustments toggle */}
                    <button
                      onClick={() => { setAdjustOpen(o => !o); setPaletteOpen(false); }}
                      className={`tape-btn tape-btn-small gap-2 ${adjustOpen ? "btn-primary" : ""}`}
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${adjustOpen ? "rotate-90" : ""}`} />
                      Adjustments
                    </button>
                  </motion.div>
                )}

                {/* Slide-up PALETTE panel */}
                <AnimatePresence>
                  {paletteOpen && (
                    <motion.div
                      key="palette-panel"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", stiffness: 380, damping: 36 }}
                      className="absolute bottom-[49px] left-0 w-full md:w-[340px] z-30 overflow-hidden"
                      style={{
                        background: "var(--surface-2)",
                        borderTop: "1px solid var(--border)",
                        borderRight: "1px solid var(--border)",
                        maxHeight: "55vh",
                        borderRadius: "0 8px 0 0",
                      }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                        <span className="hand-label">Palette Library</span>
                        <button className="btn-icon" onClick={() => setPaletteOpen(false)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: "calc(55vh - 44px)" }}>
                        <PaletteSelector
                          selectedPaletteId={selectedPalette.id}
                          onSelectPalette={handleSelectPalette}
                          sourceDNA={sourceDNA}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Slide-up ADJUSTMENTS panel */}
                <AnimatePresence>
                  {adjustOpen && (
                    <motion.div
                      key="adjust-panel"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", stiffness: 380, damping: 36 }}
                      className="absolute bottom-[49px] right-0 w-full md:w-[300px] z-30 overflow-hidden"
                      style={{
                        background: "var(--surface-2)",
                        borderTop: "1px solid var(--border)",
                        borderLeft: "1px solid var(--border)",
                        maxHeight: "55vh",
                        borderRadius: "8px 0 0 0",
                      }}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                        <span className="hand-label">Adjustments</span>
                        <button className="btn-icon" onClick={() => setAdjustOpen(false)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: "calc(55vh - 44px)" }}>
                        <ControlPanel controls={controls} onChange={handleControlChange} onReset={handleReset} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ──────────── ACT 4: THE MASTER ──────────── */}
            {act === 4 && (
              <motion.div
                key="act4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 overflow-y-auto no-scrollbar"
              >
                <div className="min-h-full flex flex-col items-center py-8 px-4 gap-6" style={{ minHeight: "100%" }}>

                  {/* ── Title ── */}
                  <motion.div
                    className="text-center flex-shrink-0"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                  >
                    <h2 className="text-xl tracking-[0.25em] uppercase font-light" style={{
                      fontFamily: "var(--font-mono), monospace",
                      color: "var(--foreground)"
                    }}>
                      The Master
                    </h2>
                    <p className="text-[10px] tracking-[0.15em] mt-1" style={{ fontFamily: "monospace", color: "var(--text-tertiary)" }}>
                      {selectedPalette.name} · Final Grade
                    </p>
                  </motion.div>

                  {/* ── Frame picker ── */}
                  <motion.div
                    className="flex-shrink-0 flex items-center gap-1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <span className="hand-label mr-2" style={{ color: "var(--text-tertiary)" }}>Frame</span>
                    {([
                      { key: "none",       label: "None" },
                      { key: "polaroid",   label: "Polaroid" },
                      { key: "film",       label: "Film" },
                      { key: "letterbox",  label: "Letterbox" },
                    ] as { key: FrameType; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFrameType(key)}
                        className="tape-btn tape-btn-small"
                        style={frameType === key ? {
                          background: "var(--accent)",
                          color: "#0f0f11",
                          borderColor: "var(--accent)",
                        } : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </motion.div>

                  {/* ── Framed image ── */}
                  <motion.div
                    className="flex-shrink-0 w-full flex justify-center"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    id="canvas-stage"
                  >
                    <FramedImage
                      frameType={frameType}
                      showNegative={showNegative}
                      signature={signatureRef.current}
                    >
                      {targetMediaUrl ? (
                        <WebGLRenderer
                          imageUrl={targetMediaUrl}
                          palette={selectedPalette}
                          controls={controls}
                          sourceStats={sourceStats}
                          wipeEnabled={false}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full" style={{ minHeight: 200 }}>
                          <p className="hand-label text-sm">No grade to develop.</p>
                        </div>
                      )}
                    </FramedImage>
                  </motion.div>

                  {/* ── Color DNA strip ── */}
                  {sourceDNA && (
                    <motion.div
                      className="flex-shrink-0 w-full max-w-2xl"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      <p className="hand-label text-[9px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>Color DNA Reference</p>
                      <div className="flex h-4 overflow-hidden rounded-sm" style={{ border: "1px solid var(--border)" }}>
                        {sourceDNA.map((c, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: `rgb(${c.join(",")})` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── Signature + Export controls ── */}
                  <motion.div
                    className="flex-shrink-0 w-full max-w-2xl"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {/* Director signature */}
                    <p className="hand-label text-[9px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>Director&apos;s Signature</p>
                    <div className="mb-4" style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <SignaturePad onSign={(url) => { signatureRef.current = url; }} width={480} height={60} />
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={() => transitionTo(3)} className="tape-btn tape-btn-small flex-shrink-0">
                        <RotateCcw className="w-3 h-3" /> Re-Edit
                      </button>
                      <button onClick={handleExportLUT} className="tape-btn tape-btn-small flex-shrink-0">
                        <Download className="w-3 h-3" /> Export .CUBE
                      </button>
                      <button
                        onClick={handleExport}
                        disabled={!targetMediaUrl || exporting}
                        className="tape-btn btn-primary flex-shrink-0 ml-auto"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {exporting ? "Processing…" : exported ? "Exported ✓" : "Export Image"}
                      </button>
                    </div>
                  </motion.div>

                  {/* Breathing room at bottom */}
                  <div className="flex-shrink-0 h-8" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
