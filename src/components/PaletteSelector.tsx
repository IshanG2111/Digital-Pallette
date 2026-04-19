"use client";

import React, { useState } from "react";
import { Palette as PaletteType, RGB } from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";

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

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
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
    ? { id: "__source_dna__", name: "SOURCE DNA", colors: sourceDNA }
    : null;

  const isSourceSelected = selectedPaletteId === "__source_dna__";

  return (
    <section className="flex flex-col h-full overflow-hidden px-10 py-12" id="palette-selector">
      {/* Header */}
      <div className="flex items-center justify-between pb-10 flex-shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-text-secondary">CHROMATIC DNA</span>
      </div>

      <div className="w-full h-[1px] bg-white/10 mb-10" />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* Source DNA palette */}
        {sourcePalette && (
          <div className="mb-14">
            <h4 className="text-[12px] font-bold tracking-[0.4em] mb-8 text-foreground/40">EXTRACTED</h4>
            <button
              onClick={() => onSelectPalette(sourcePalette)}
              className="w-full text-left group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] transition-colors"
                  style={{ color: isSourceSelected ? "var(--foreground)" : "var(--text-secondary)" }}
                >
                  {sourcePalette.name}
                </span>
                {isSourceSelected && <span className="text-accent text-[10px] font-bold tracking-widest">[ ACTIVE ]</span>}
              </div>
              <div className="flex h-14 w-full rounded-sm overflow-hidden">
                {sourcePalette.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full transition-all duration-700 hover:flex-[2]"
                    style={{ backgroundColor: `rgb(${color.join(",")})` }}
                  />
                ))}
              </div>
            </button>
          </div>
        )}

        {/* Preset palettes */}
        <div className="flex flex-col gap-12">
          <h4 className="text-[12px] font-bold tracking-[0.4em] text-foreground/40">ARCHIVE</h4>
          {sortedPalettes.map((palette) => {
            const isSelected = selectedPaletteId === palette.id;
            const isFav = favorites.has(palette.id);

            return (
              <div key={palette.id} className="group relative">
                <button
                  onClick={() => onSelectPalette(palette)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-500"
                      style={{ color: isSelected ? "var(--foreground)" : "var(--text-secondary)" }}
                    >
                      {palette.name}
                    </span>
                    <div className="flex items-center gap-3">
                      {isSelected && <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--foreground)" }}>[ ACTIVE ]</span>}
                    </div>
                  </div>
                  
                  {/* Floating Chroma Strip */}
                  <div className="flex h-[2px] w-full opacity-60 group-hover:opacity-100 group-hover:h-12 transition-all duration-700 cubic-bezier(0.19, 1, 0.22, 1) rounded-sm overflow-hidden">
                    {palette.colors.map((color, i) => (
                      <div
                        key={i}
                        className="flex-1 h-full transition-all duration-500 hover:flex-[1.5]"
                        style={{ backgroundColor: `rgb(${color.join(",")})` }}
                      />
                    ))}
                  </div>
                </button>

                {/* Hidden favorite toggle that appears left of the palette on hover */}
                <button
                  onClick={(e) => toggleFavorite(e, palette.id)}
                  className="absolute -left-6 top-0 text-[14px] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  style={{ color: isFav ? "var(--accent)" : "var(--text-tertiary)" }}
                >
                  {isFav ? "★" : "☆"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
