"use client";

import React, { useState, useCallback } from "react";
import MediaUploader from "@/components/ImageUploader";
import PaletteSelector from "@/components/PaletteSelector";
import CanvasRenderer from "@/components/CanvasRenderer";
import VideoBarcodeRenderer from "@/components/VideoBarcodeRenderer";
import ControlPanel from "@/components/ControlPanel";
import {
  Palette,
  ControlState,
  DEFAULT_CONTROLS,
  MediaType,
  EngineStatus,
} from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";
import {
  Clapperboard,
  Download,
  Loader2,
  Check,
} from "lucide-react";

export default function Home() {
  // ── Media state ──
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);

  // ── Grading state ──
  const [selectedPalette, setSelectedPalette] = useState<Palette>(
    PRESET_PALETTES[0]
  );
  const [controls, setControls] = useState<ControlState>({
    ...DEFAULT_CONTROLS,
  });

  // ── Engine status ──
  const [engine, setEngine] = useState<EngineStatus>({
    state: "idle",
    message: "Waiting for media",
  });

  // ── Export state ──
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  // ── Handlers ──
  const handleUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    const type: MediaType = file.type.startsWith("video/") ? "video" : "image";
    setMediaType(type);
    setEngine({ state: "ready", message: "Engine ready" });
    setExported(false);
  }, []);

  const handleClear = useCallback(() => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setMediaUrl(null);
    setMediaType(null);
    setEngine({ state: "idle", message: "Waiting for media" });
    setExported(false);
  }, [mediaUrl]);

  const handleControlChange = useCallback(
    (key: keyof ControlState, value: number) => {
      setControls((prev) => ({ ...prev, [key]: value }));
      setExported(false);
    },
    []
  );

  const handleReset = useCallback(() => {
    setControls({ ...DEFAULT_CONTROLS });
    setExported(false);
  }, []);

  const handleSelectPalette = useCallback((p: Palette) => {
    setSelectedPalette(p);
    setExported(false);
  }, []);

  // ── Export: download the graded canvas ──
  const handleExport = useCallback(() => {
    // For images, grab the processed canvas and download
    const processed = document.querySelector(
      "#canvas-stage canvas:nth-child(2)"
    ) as HTMLCanvasElement | null;
    if (!processed) return;

    setExporting(true);
    setEngine({ state: "processing", message: "Exporting…" });

    // Small delay to show feedback
    setTimeout(() => {
      const link = document.createElement("a");
      link.download = `directors-palette-${Date.now()}.png`;
      link.href = processed.toDataURL("image/png");
      link.click();

      setExporting(false);
      setExported(true);
      setEngine({ state: "done", message: "Exported" });

      setTimeout(
        () => setEngine({ state: "ready", message: "Engine ready" }),
        2000
      );
    }, 600);
  }, []);

  // ── Status indicator color ──
  const statusColor = {
    idle: "text-white/30",
    ready: "text-emerald-400",
    processing: "text-amber-400",
    done: "text-emerald-400",
    error: "text-red-400",
  }[engine.state];

  return (
    <main className="min-h-screen flex flex-col max-w-[1920px] mx-auto">
      {/* ═══════════ Top Bar ═══════════ */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-[#08080c]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Clapperboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              Director&apos;s Palette
            </h1>
            <p className="text-[10px] text-white/35 font-mono tracking-widest uppercase mt-0.5">
              Cinematic Color Grading
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Engine status pill */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono ${statusColor}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  engine.state === "processing" ? "animate-ping" : ""
                } ${
                  engine.state === "ready" || engine.state === "done"
                    ? "bg-emerald-400"
                    : engine.state === "processing"
                    ? "bg-amber-400"
                    : "bg-white/30"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  engine.state === "ready" || engine.state === "done"
                    ? "bg-emerald-400"
                    : engine.state === "processing"
                    ? "bg-amber-400"
                    : "bg-white/30"
                }`}
              />
            </span>
            {engine.message}
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={!mediaUrl || mediaType !== "image" || exporting}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !mediaUrl || mediaType !== "image"
                ? "bg-white/5 text-white/20 cursor-not-allowed"
                : exported
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 hover:border-primary/30"
            }`}
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : exported ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {exporting ? "Exporting…" : exported ? "Saved" : "Export"}
          </button>
        </div>
      </header>

      {/* ═══════════ Main Layout ═══════════ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-0 min-h-0">
        {/* ── Left Sidebar ── */}
        <aside className="border-r border-white/[0.04] p-4 flex flex-col gap-6 overflow-y-auto no-scrollbar lg:max-h-[calc(100vh-52px)]">
          <div className="flex-shrink-0 h-[200px] min-h-[180px]">
            <MediaUploader
              onUpload={handleUpload}
              onClear={handleClear}
              currentMediaUrl={mediaUrl}
              mediaType={mediaType}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
            <PaletteSelector
              selectedPaletteId={selectedPalette.id}
              onSelectPalette={handleSelectPalette}
            />
          </div>
        </aside>

        {/* ── Center Stage ── */}
        <div
          id="canvas-stage"
          className="flex flex-col p-4 lg:p-5 overflow-y-auto no-scrollbar lg:max-h-[calc(100vh-52px)]"
        >
          {mediaType === "video" && mediaUrl ? (
            <VideoBarcodeRenderer videoUrl={mediaUrl} />
          ) : (
            <CanvasRenderer
              imageUrl={mediaUrl}
              palette={selectedPalette}
              controls={controls}
            />
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <aside className="border-l border-white/[0.04] p-4 flex flex-col gap-6 overflow-y-auto no-scrollbar lg:max-h-[calc(100vh-52px)]">
          <ControlPanel
            controls={controls}
            onChange={handleControlChange}
            onReset={handleReset}
          />

          {/* Active palette summary */}
          {mediaUrl && (
            <div className="glass-panel rounded-xl p-3 animate-fade-in">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/30 block mb-2">
                Active Palette
              </span>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-white/70">
                  {selectedPalette.name}
                </span>
              </div>
              <div className="flex h-4 rounded overflow-hidden">
                {selectedPalette.colors.map((c, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full"
                    style={{ backgroundColor: `rgb(${c.join(",")})` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quick info */}
          <div className="mt-auto pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-white/20 font-mono leading-relaxed">
              Upload an image or video → select a palette → adjust sliders → export the graded result. Drag the divider
              in the preview to compare before/after.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
