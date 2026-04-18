"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface SmpteLoaderProps {
  message?: string;
  progress?: number;
  animate?: boolean;
}

// Classic SMPTE color bars, but in the cinema palette
const BARS = [
  { color: "#c0c0c0", weight: 6 },  // White
  { color: "#c0c000", weight: 6 },  // Yellow
  { color: "#00c0c0", weight: 6 },  // Cyan
  { color: "#00c000", weight: 6 },  // Green
  { color: "#c000c0", weight: 6 },  // Magenta
  { color: "#c00000", weight: 6 },  // Red
  { color: "#0000c0", weight: 6 },  // Blue
];

const BOTTOM_BARS = [
  { color: "#0000c0", weight: 5 },
  { color: "#131313", weight: 5 },
  { color: "#c000c0", weight: 5 },
  { color: "#131313", weight: 10 },
  { color: "#0000c0", weight: 5 },
  { color: "#131313", weight: 5 },
  { color: "#c0c0c0", weight: 5 },
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
    <div className="relative w-full h-full min-h-[200px] flex flex-col overflow-hidden rounded-[4px]" style={{ background: "#000" }}>
      {/* Top 75% — Color bars */}
      <div className="flex" style={{ flex: "0 0 75%" }}>
        {BARS.map((bar, i) => (
          <div
            key={i}
            className="h-full"
            style={{ flex: bar.weight, backgroundColor: bar.color }}
          />
        ))}
      </div>

      {/* Bottom 25% — SMPTE secondary strip */}
      <div className="flex" style={{ flex: "0 0 25%" }}>
        {BOTTOM_BARS.map((bar, i) => (
          <div
            key={i}
            className="h-full"
            style={{ flex: bar.weight, backgroundColor: bar.color }}
          />
        ))}
      </div>

      {/* Overlay: "PLEASE STAND BACK" message */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            background: "rgba(0,0,0,0.82)",
            border: "1px solid rgba(212,168,83,0.3)",
            backdropFilter: "blur(4px)",
          }}
          className="px-8 py-5 rounded-sm text-center max-w-xs"
        >
          <p className="text-sm uppercase tracking-[0.3em]" style={{ 
            fontFamily: "monospace", color: "#e8e8ea", letterSpacing: "0.3em" 
          }}>
            {message}{dots}
          </p>
          {progress !== undefined && (
            <div className="mt-4">
              <div className="h-px w-full" style={{ background: "rgba(58,58,72,1)" }}>
                <motion.div
                  className="h-full"
                  style={{ background: "#d4a853", width: `${progress}%`, transition: "width 0.3s ease" }}
                />
              </div>
              <p className="text-[10px] mt-2 tabular-nums" style={{ color: "#5a5a68", fontFamily: "monospace" }}>
                {Math.round(progress)}%
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
