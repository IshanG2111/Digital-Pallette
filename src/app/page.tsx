"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MediaUploader from "@/components/ImageUploader";
import PaletteSelector from "@/components/PaletteSelector";
import WebGLRenderer from "@/components/WebGLRenderer";
import VideoBarcodeRenderer from "@/components/VideoBarcodeRenderer";
import ControlPanel from "@/components/ControlPanel";
import ChalkLoader from "@/components/ChalkLoader";
import StudioOpener from "@/components/StudioOpener";
import {
  Palette,
  ControlState,
  DEFAULT_CONTROLS,
  MediaType,
  RGB,
} from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";
import { generateCubeLUT, computeChannelStats, ChannelStats, extractDominantColorsLAB } from "@/lib/colorEngine";
import { useUISound } from "@/hooks/useUISound";
import { Aperture } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const ACTS = [
  { num: 1, label: "INGEST" },
  { num: 2, label: "ALCHEMY" },
  { num: 3, label: "DARKROOM" },
  { num: 4, label: "MASTER" },
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { playCrinkle, playSlateClap, playScratch, playShutter, playProjectorHum } = useUISound();

  /* ── Extraction ───────────────────────────────────────────────────────── */
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionDone, setExtractionDone] = useState(false);
  const [sourceDNA, setSourceDNA] = useState<RGB[] | null>(null);

  /* ── Media ─────────────────────────────────────────────────────────────── */
  const [sourceMediaUrl, setSourceMediaUrl] = useState<string | null>(null);
  const [targetMediaUrl, setTargetMediaUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<MediaType>(null);
  const [sourceStats, setSourceStats] = useState<ChannelStats | null>(null);

  /* ── Grading ───────────────────────────────────────────────────────────── */
  const [selectedPalette, setSelectedPalette] = useState<Palette>(PRESET_PALETTES[0]);
  const [controls, setControls] = useState<ControlState>({ ...DEFAULT_CONTROLS });

  /* ── Export ─────────────────────────────────────────────────────────────── */
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const signatureRef = useRef<string | null>(null);

  const fireFilmBurn = () => setFilmBurnKey(k => k + 1);
  const transitionTo = (n: number) => {
    fireFilmBurn();
    setTimeout(() => setAct(n), 280);
  };

  /* ACT 1 → 2: Source upload */
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
        setSourceStats(computeChannelStats(imgData.data));
        setSourceDNA(extractDominantColorsLAB(imgData.data, 5));
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

  /* ACT 2: Extraction progress */
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

  /* ACT 3: Target upload */
  const handleTargetUpload = useCallback((file: File) => {
    setTargetMediaUrl(URL.createObjectURL(file));
    playCrinkle();
  }, [playCrinkle]);

  const handleControlChange = useCallback((key: keyof ControlState, value: number | boolean) => {
    setControls(prev => ({ ...prev, [key]: value }));
    setExported(false);
  }, []);

  const handleReset = useCallback(() => {
    setControls({ ...DEFAULT_CONTROLS });
    setExported(false);
  }, []);

  const handleSelectPalette = useCallback((p: Palette) => {
    setSelectedPalette(p);
    setExported(false);
  }, []);

  const handleAutoGrade = useCallback(() => {
    playScratch();
    
    // Check if we have sourceDNA to calculate clever dynamics
    if (sourceDNA && sourceDNA.length > 0) {
      // Calculate overall perceptual luminance to guess exposure/contrast
      let totalLuma = 0;
      sourceDNA.forEach(c => totalLuma += (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]));
      const avgLuma = totalLuma / sourceDNA.length;
      
      // If dark image, boost exposure slightly and open shadows.
      // If bright image, deepen shadows and decrease highlights.
      const isDark = avgLuma < 80;
      const isBright = avgLuma > 180;
      
      setControls(prev => ({
        ...prev,
        intensity: 85,
        exposure: isDark ? 15 : (isBright ? -5 : 5),
        contrast: 15,
        highlights: isBright ? -15 : -5,
        shadows: isDark ? 15 : 5,
        saturation: 10,
        vibrance: 25,
      }));
    } else {
      // Fallback
      setControls(prev => ({
        ...prev,
        intensity: 80, exposure: 0, shadow: 10,
        contrast: 15, vibrance: 20
      }));
    }
  }, [sourceDNA, playScratch]);
  const handleExport = useCallback(() => {
    const webglCanvas = document.querySelector("#canvas-stage canvas") as HTMLCanvasElement | null;
    if (!webglCanvas) return;
    
    setExporting(true);
    setShowFlash(true);
    playShutter();
    setTimeout(() => { setShowFlash(false); }, 800);

    setTimeout(() => {
      const a = document.createElement("a");
      a.download = `directors_palette_${Date.now()}.png`;
      a.href = webglCanvas.toDataURL("image/png");
      a.click();
      setExporting(false);
      setExported(true);
    }, 550);
  }, [playShutter]);

  const goTo = (n: number) => { if (n >= 1 && n <= 4 && n <= act) transitionTo(n); };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <main className="h-screen w-full flex flex-col overflow-hidden text-foreground relative z-0" style={{ background: "var(--background)" }}>
        <AnimatePresence>
          {showOpener && <StudioOpener onComplete={() => setShowOpener(false)} />}
        </AnimatePresence>

        {showFlash && <div className="absolute inset-0 z-[200] bg-white animate-shutter" />}
        <AnimatePresence>
          {filmBurnKey > 0 && <div key={filmBurnKey} className="absolute inset-0 z-[150] pointer-events-none animate-film-burn bg-white opacity-0" />}
        </AnimatePresence>

        {/* ═══════════ SPATIAL NAVIGATION ═══════════ */}
        {/* Floating Top Left - Context */}
        <div className="absolute top-8 left-8 z-50 pointer-events-none">
           <div className="flex items-center gap-3">
              <Aperture className="w-4 h-4 text-accent animate-spin-slow" />
              <div className="flex flex-col">
                 <span className="micro-label">DIRECTOR'S PALETTE</span>
                 <span className="text-[10px] text-text-tertiary">VIRTUAL MASTERPIECE</span>
              </div>
           </div>
        </div>

        {/* Floating Top Right - Progression */}
        <div className="absolute top-8 right-8 flex items-center gap-8 z-50">
           {act > 1 && (
             <button onClick={() => goTo(act - 1)} className="gallery-btn">
                [ BACK ]
             </button>
           )}
           {act === 2 && extractionDone && (
             <button onClick={() => transitionTo(3)} className="gallery-btn gallery-btn-forward text-accent">
                [ PROCEED TO DARKROOM ]
             </button>
           )}
           {act === 3 && targetMediaUrl && (
             <button onClick={() => transitionTo(4)} className="gallery-btn gallery-btn-forward text-accent">
                [ APPROVE MASTER ]
             </button>
           )}
           {act === 4 && (
             <button onClick={handleExport} disabled={exporting} className="gallery-btn gallery-btn-forward text-accent">
                {exporting ? "[ PROCESSING ]" : "[ EXPORT ]"}
             </button>
           )}
        </div>

        {/* Floating Bottom Left - Progress */}
        <div className="absolute bottom-8 left-8 z-50 flex items-center gap-4">
           {ACTS.map((a, i) => (
             <div key={a.num} className="flex items-center gap-4">
                <span className="micro-label" style={{ opacity: act === a.num ? 1 : 0.3 }}>
                   0{a.num}
                </span>
                {i < 3 && <div className="w-8 h-px bg-border" />}
             </div>
           ))}
        </div>

        {/* ═══════════ GIANT TYPOGRAPHIC WATERMARK ═══════════ */}
        <div className="absolute inset-0 flex items-center justify-center z-[-1] pointer-events-none overflow-hidden">
           <AnimatePresence mode="wait">
             <motion.div
                key={`watermark-${act}`}
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 1.05 }}
                transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                className="gallery-title"
             >
                {ACTS[act-1].label}
             </motion.div>
           </AnimatePresence>
        </div>

        {/* ═══════════ MAIN STAGE ═══════════ */}
        <div className="flex-1 w-full h-full relative z-10" style={{ perspective: "1500px" }}>
          <AnimatePresence mode="wait">

            {/* ──────────── ACT 1: THE INGEST ──────────── */}
            {act === 1 && (
              <motion.div
                key="act1"
                initial={{ opacity: 0, rotateY: 15, scale: 0.9 }}
                animate={{ opacity: 1, rotateY: 5, rotateX: 2, scale: 1 }}
                exit={{ opacity: 0, rotateY: -10, scale: 0.95 }}
                transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-full max-w-2xl px-12">
                   <div className="reveal-mask mb-12">
                     <h1 className="font-serif text-5xl font-light text-foreground animate-curtain leading-[1.1]">
                        Initiate the<br/><span className="text-accent italic">Canvas</span>
                     </h1>
                   </div>
                   
                   <motion.div
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.4, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
                     className="w-full h-[400px]"
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
                className="absolute inset-0 flex items-center p-16 gap-16 transform-style-3d"
              >
                {/* Image display */}
                <motion.div
                   initial={{ opacity: 0, x: -60, rotateY: 20 }}
                   animate={{ opacity: 1, x: 0, rotateY: 8 }}
                   exit={{ opacity: 0, scale: 0.95, rotateY: 15 }}
                   transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
                   className="flex-[6] h-[70vh] relative flex items-center justify-center p-8 border border-white/5 shadow-2xl"
                   style={{ transformOrigin: "right center" }}
                >
                   {sourceType === "video" && sourceMediaUrl ? (
                     <VideoBarcodeRenderer videoUrl={sourceMediaUrl} onExtractPalette={handleSelectPalette} />
                   ) : sourceMediaUrl ? (
                     <img src={sourceMediaUrl} alt="Source" className="w-full h-full object-contain filter grayscale opacity-80 mix-blend-screen" />
                   ) : null}

                   {/* Scanning overlay */}
                   {!extractionDone && (
                     <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md">
                       <ChalkLoader progress={extractionProgress} message="ANALYZING COLOR GEOMETRY..." />
                     </div>
                   )}
                </motion.div>

                {/* Extracted DNA Side */}
                <motion.div
                   initial={{ opacity: 0, x: 60, rotateY: -20 }}
                   animate={{ opacity: extractionDone ? 1 : 0, rotateY: -8 }}
                   transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}
                   className="flex-[4] flex flex-col justify-center h-full max-h-[70vh]"
                   style={{ transformOrigin: "left center" }}
                >
                   <span className="micro-label mb-8 text-accent">CHROMATIC EXTRACTION</span>
                   {extractionDone && sourceDNA && (
                     <div className="flex flex-col gap-8 w-full">
                        {sourceDNA.map((c, i) => (
                           <motion.div 
                              key={i}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + (i * 0.1), duration: 0.6 }}
                              className="flex items-center gap-6 group cursor-pointer"
                           >
                              <div className="flex-1 h-px bg-white/20 group-hover:bg-white/50 transition-colors" />
                              <div 
                                 className="w-16 h-16 rounded-sm shadow-2xl transition-transform duration-500 group-hover:scale-125 group-hover:rotate-6"
                                 style={{ backgroundColor: `rgb(${c.join(",")})`, boxShadow: `0 0 20px rgba(${c.join(",")}, 0.3)` }} 
                              />
                              <div className="flex-1 h-px bg-white/20 group-hover:bg-white/50 transition-colors" />
                           </motion.div>
                        ))}
                     </div>
                   )}
                </motion.div>

              </motion.div>
            )}

            {/* ──────────── ACT 3: THE DARKROOM ──────────── */}
            {act === 3 && (
              <motion.div
                key="act3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <div className="absolute inset-0 -z-10 blur-[100px] opacity-10 pointer-events-none" style={{ backgroundColor: selectedPalette.colors[2] ? `rgb(${selectedPalette.colors[2].join(",")})` : "var(--accent)" }} />
                
                <motion.div 
                  className="w-full max-w-[80%] h-[75vh] relative shadow-2xl overflow-hidden rounded-sm"
                  initial={{ rotateY: -15, rotateX: 5 }}
                  animate={{ rotateY: [-5, -2, -5], rotateX: [2, 1, 2] }}
                  transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
                  style={{ transformStyle: "preserve-3d" }}
                  id="canvas-stage"
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
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-full max-w-lg px-8">
                         <div className="reveal-mask mb-12 text-center">
                           <h2 className="font-serif text-4xl font-light text-foreground animate-curtain">
                              Target <span className="text-accent italic">Canvas</span>
                           </h2>
                         </div>
                         <div style={{ height: 320 }}>
                           <MediaUploader
                             onUpload={handleTargetUpload}
                             onClear={() => setTargetMediaUrl(null)}
                             currentMediaUrl={targetMediaUrl}
                             mediaType="image"
                           />
                         </div>
                       </div>
                    </div>
                  )}
                </motion.div>

                {/* Spatial Toggles Bottom Right */}
                {targetMediaUrl && (
                  <div className="absolute bottom-8 right-8 flex items-center gap-8 z-50">
                    <button
                      onClick={() => { setAdjustOpen(false); setPaletteOpen(o => !o); }}
                      className="gallery-btn"
                    >
                       [ CHROMA ]
                    </button>
                    <button
                      onClick={() => { setPaletteOpen(false); setAdjustOpen(o => !o); }}
                      className="gallery-btn"
                    >
                       [ ADJUST ]
                    </button>
                  </div>
                )}

                {/* Slide-out Panels (Unboxed) */}
                <AnimatePresence>
                  {(paletteOpen || adjustOpen) && (
                    <motion.div
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "100%" }}
                      transition={{ type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.6 }}
                      className="absolute top-0 right-0 w-[400px] h-full z-40 bg-background/95 backdrop-blur-3xl border-l border-white/5"
                    >
                      {paletteOpen && (
                        <PaletteSelector
                          selectedPaletteId={selectedPalette.id}
                          onSelectPalette={handleSelectPalette}
                          sourceDNA={sourceDNA}
                        />
                      )}
                      {adjustOpen && (
                        <ControlPanel controls={controls} onChange={handleControlChange} onReset={handleReset} onAutoGrade={handleAutoGrade} />
                      )}
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
                transition={{ duration: 1 }}
                className="absolute inset-0 flex flex-col p-16 items-center"
              >
                 {/* Majestic Backlight via Palette DNA */}
                 <div className="absolute inset-0 -z-10 blur-[120px] opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle, rgb(${selectedPalette.colors[1].join(",")}) 0%, transparent 60%)` }} />
                 
                 <div className="flex flex-col items-center flex-shrink-0 mb-8 mt-4 z-20">
                    <h2 className="font-serif text-5xl font-light mb-4 text-foreground">
                       Final <span className="text-accent italic">Exhibition</span>
                    </h2>
                    <p className="micro-label opacity-50 max-w-md text-center leading-relaxed">
                       Procedural chromatic shifts locked. The piece is ready for export.
                    </p>
                 </div>
                 <div className="flex-1 min-h-0 relative z-10 p-8 w-full flex items-center justify-center">
                    <motion.div 
                      className="w-full max-w-6xl aspect-video relative shadow-2xl" id="canvas-stage"
                      initial={{ scale: 0.95, rotateY: 10, rotateX: -5 }}
                      whileHover={{ scale: 1, rotateY: 0, rotateX: 0 }}
                      animate={{ rotateY: 5, rotateX: 2 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 ring-1 ring-white/10 pointer-events-none z-10" />
                      {targetMediaUrl && (
                        <WebGLRenderer
                          imageUrl={targetMediaUrl}
                          palette={selectedPalette}
                          controls={controls}
                          sourceStats={sourceStats}
                        />
                      )}
                    </motion.div>
                 </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
