"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface SmpteLoaderProps {
  message?: string;
  progress?: number;
  animate?: boolean;
}

// Hand-drawn SMPTE color bars in muted chalk pastels
const BARS = [
  { color: "#f4f0ec", weight: 6 },  // Chalk White
  { color: "#e5c07b", weight: 6 },  // Chalk Yellow
  { color: "#6aa49c", weight: 6 },  // Muted Teal
  { color: "#88c096", weight: 6 },  // Chalk Green
  { color: "#d0879f", weight: 6 },  // Dusty Pink
  { color: "#db7676", weight: 6 },  // Chalk Red
  { color: "#6f88a3", weight: 6 },  // Slate Blue
];

const BOTTOM_BARS = [
  { color: "#6f88a3", weight: 5 },  // Blue
  { color: "#363b40", weight: 5 },  // Dark
  { color: "#d0879f", weight: 5 },  // Pink
  { color: "#363b40", weight: 10 }, // Dark
  { color: "#6f88a3", weight: 5 },  // Blue
  { color: "#363b40", weight: 5 },  // Dark
  { color: "#f4f0ec", weight: 5 },  // White
];

export default function SmpteLoader({ message = "PLEASE STAND BACK", progress, animate: _animate = true }: SmpteLoaderProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const int = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".");
    }, 500);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[200px] flex flex-col overflow-hidden rounded-[8px_255px_12px_25px/255px_8px_225px_12px]" style={{ background: "#25282c" }}>
      {/* Hand-drawn SVG Filter */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <filter id="chalk-smpte" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          {/* Blend to make it rougher */}
          <feComposite in="SourceGraphic" in2="displaced" operator="in" />
        </filter>
      </svg>

      <div className="absolute inset-0 z-0 flex flex-col" style={{ filter: "url(#chalk-smpte)", opacity: 0.85 }}>
        {/* Top 75% — Color bars */}
        <div className="flex" style={{ flex: "0 0 75%" }}>
          {BARS.map((bar, i) => (
            <div
              key={`top-${i}`}
              className="h-full"
              style={{ flex: bar.weight, backgroundColor: bar.color }}
            />
          ))}
        </div>

        {/* Bottom 25% — SMPTE secondary strip */}
        <div className="flex" style={{ flex: "0 0 25%" }}>
          {BOTTOM_BARS.map((bar, i) => (
            <div
              key={`bottom-${i}`}
              className="h-full"
              style={{ flex: bar.weight, backgroundColor: bar.color }}
            />
          ))}
        </div>
      </div>

      {/* Overlay: "PLEASE STAND BACK" message */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          style={{
            background: "rgba(37,40,44,0.85)",
            border: "2px solid rgba(229,192,123,0.4)",
            borderRadius: "255px 2px 225px 3px / 3px 255px 5px 25px",
            backdropFilter: "blur(4px)",
            boxShadow: "2px 3px 0px rgba(0,0,0,0.3)"
          }}
          className="px-8 py-5 text-center max-w-xs"
        >
          <p className="text-sm font-bold tracking-[0.15em] uppercase" style={{ 
            fontFamily: "var(--font-hand), cursive", color: "#f4f0ec"
          }}>
            {message}{dots}
          </p>
          {progress !== undefined && (
            <div className="mt-4">
              <div className="h-2 w-full rounded-sm" style={{ background: "rgba(68,74,71,1)" }}>
                <motion.div
                  className="h-full rounded-sm"
                  style={{ background: "#e5c07b", width: `${progress}%`, transition: "width 0.3s ease" }}
                />
              </div>
              <p className="text-[12px] font-bold mt-2 tabular-nums" style={{ color: "#aeb5b0", fontFamily: "var(--font-hand), cursive" }}>
                {Math.round(progress)}%
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
