"use client";

import React, { useState } from "react";
import { Palette as PaletteType } from "@/types";
import { PRESET_PALETTES } from "@/lib/constants";
import { Palette as PaletteIcon, Heart } from "lucide-react";

interface PaletteSelectorProps {
  selectedPaletteId: string | null;
  onSelectPalette: (palette: PaletteType) => void;
}

export default function PaletteSelector({
  selectedPaletteId,
  onSelectPalette,
}: PaletteSelectorProps) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Show favorites first
  const sortedPalettes = [...PRESET_PALETTES].sort((a, b) => {
    const af = favorites.has(a.id) ? 0 : 1;
    const bf = favorites.has(b.id) ? 0 : 1;
    return af - bf;
  });

  return (
    <section className="flex flex-col gap-3" id="palette-selector">
      <h2 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
        <PaletteIcon className="w-4 h-4" /> Palettes
      </h2>

      <div className="flex flex-col gap-2">
        {sortedPalettes.map((palette) => {
          const isSelected = selectedPaletteId === palette.id;
          const isFav = favorites.has(palette.id);

          return (
            <div
              key={palette.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectPalette(palette)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPalette(palette);
                }
              }}
              className={`glass-panel rounded-lg p-2.5 transition-all duration-200 text-left w-full group relative cursor-pointer ${
                isSelected
                  ? "border-primary/40 ring-1 ring-primary/20 bg-primary/5"
                  : "border-white/[0.04] hover:border-white/10 hover:bg-white/[0.02]"
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-medium tracking-wide ${
                    isSelected ? "text-primary" : "text-white/70"
                  }`}
                >
                  {palette.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => toggleFavorite(e, palette.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleFavorite(
                          e as unknown as React.MouseEvent,
                          palette.id
                        );
                      }
                    }}
                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                      isFav
                        ? "text-rose-400"
                        : "text-white/20 opacity-0 group-hover:opacity-100"
                    }`}
                    aria-label={
                      isFav ? "Remove from favorites" : "Add to favorites"
                    }
                  >
                    <Heart
                      className="w-3 h-3"
                      fill={isFav ? "currentColor" : "none"}
                    />
                  </span>
                </div>
              </div>

              {/* Color strip */}
              <div className="flex h-5 rounded-md overflow-hidden">
                {palette.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full transition-all duration-200 group-hover:first:flex-[1.3] group-hover:last:flex-[1.3]"
                    style={{ backgroundColor: `rgb(${color.join(",")})` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
