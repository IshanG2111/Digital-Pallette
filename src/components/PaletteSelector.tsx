"use client";

import React, { useState } from "react";
import { Palette as PaletteType, RGB } from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";
import { Heart, Sparkles } from "lucide-react";
import { useUISound } from "@/hooks/useUISound";

interface PaletteSelectorProps {
  selectedPaletteId: string | null;
  onSelectPalette: (palette: PaletteType) => void;
  sourceDNA?: RGB[] | null;
}

export default function PaletteSelector({
  selectedPaletteId,
  onSelectPalette,
  sourceDNA,
}: PaletteSelectorProps) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { playScratch, playCrinkle } = useUISound();

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playScratch();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortedPalettes = [...PRESET_PALETTES].sort((a, b) => {
    return (favorites.has(a.id) ? 0 : 1) - (favorites.has(b.id) ? 0 : 1);
  });

  const sourcePalette: PaletteType | null = sourceDNA && sourceDNA.length >= 3
    ? { id: "__source_dna__", name: "Source DNA", colors: sourceDNA }
    : null;

  const isSourceSelected = selectedPaletteId === "__source_dna__";

  return (
    <section className="flex flex-col h-full" id="palette-selector" style={{ gap: 0 }}>
      {/* Header */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="hand-label" style={{ color: "var(--text-secondary)" }}>Palettes</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Source DNA palette */}
        {sourcePalette && (
          <div className="p-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="hand-label text-[9px] mb-2 flex items-center gap-1.5" style={{ color: "var(--text-tertiary)" }}>
              <Sparkles className="w-2.5 h-2.5" style={{ color: "var(--accent)" }} />
              Extracted DNA
            </div>
            <button
              onClick={() => { playCrinkle(); onSelectPalette(sourcePalette); }}
              className="w-full text-left transition-all duration-150 rounded-sm overflow-hidden"
              style={{
                border: isSourceSelected
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                boxShadow: isSourceSelected ? "0 0 0 1px var(--accent-muted), 0 0 16px var(--accent-glow)" : "none",
              }}
            >
              {/* Color strip */}
              <div className="flex h-10">
                {sourcePalette.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full"
                    style={{ backgroundColor: `rgb(${color.join(",")})` }}
                  />
                ))}
              </div>
              {/* Label bar */}
              <div className="px-2.5 py-1.5 flex items-center justify-between" style={{ background: "var(--surface-3)" }}>
                <span className="text-[10px] tracking-wider" style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  Source DNA
                </span>
                {isSourceSelected && (
                  <span className="sketch-dot" />
                )}
              </div>
            </button>
          </div>
        )}

        {/* Preset palettes */}
        <div className="p-3 flex flex-col gap-2">
          <div className="hand-label text-[9px] mb-1" style={{ color: "var(--text-tertiary)" }}>
            Preset Library
          </div>
          {sortedPalettes.map((palette) => {
            const isSelected = selectedPaletteId === palette.id;
            const isFav = favorites.has(palette.id);

            return (
              <button
                key={palette.id}
                onClick={() => { playCrinkle(); onSelectPalette(palette); }}
                className="w-full text-left group transition-all duration-150 rounded-sm overflow-hidden"
                style={{
                  border: isSelected
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                  boxShadow: isSelected ? "0 0 0 1px var(--accent-muted)" : "none",
                }}
              >
                {/* Thin color preview strip */}
                <div className="flex h-7">
                  {palette.colors.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-full"
                      style={{ backgroundColor: `rgb(${color.join(",")})` }}
                    />
                  ))}
                </div>
                {/* Label bar */}
                <div
                  className="px-2.5 py-1.5 flex items-center justify-between"
                  style={{ background: isSelected ? "var(--surface-4)" : "var(--surface-3)" }}
                >
                  <span
                    className="text-[10px] tracking-wider"
                    style={{
                      fontFamily: "monospace",
                      color: isSelected ? "var(--foreground)" : "var(--text-secondary)"
                    }}
                  >
                    {palette.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isSelected && <span className="sketch-dot" />}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => toggleFavorite(e, palette.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleFavorite(e as unknown as React.MouseEvent, palette.id);
                        }
                      }}
                      className="transition-opacity"
                      style={{
                        opacity: isFav ? 1 : 0,
                        color: "var(--accent)"
                      }}
                    >
                      <Heart className="w-3 h-3 group-hover:opacity-100" style={{ opacity: isFav ? 1 : 0.4 }} fill={isFav ? "currentColor" : "none"} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
