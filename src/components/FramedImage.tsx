"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type FrameType = "none" | "polaroid" | "film" | "letterbox";

interface FramedImageProps {
  frameType: FrameType;
  showNegative?: boolean;
  signature?: string | null;
  children: React.ReactNode;
}

export default function FramedImage({ frameType, showNegative, signature, children }: FramedImageProps) {
  const base = showNegative ? "animate-negative-flash" : "";

  if (frameType === "none") {
    return (
      <div
        className={`w-full max-w-3xl overflow-hidden rounded-sm ${base}`}
        style={{ border: "1px solid var(--border)", background: "#000" }}
      >
        <div style={{ aspectRatio: "16/9", position: "relative" }}>{children}</div>
      </div>
    );
  }

  if (frameType === "polaroid") {
    return (
      <motion.div
        className={`flex flex-col items-center ${base}`}
        style={{
          background: "#f5f0e8",
          padding: "16px 16px 48px 16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
          maxWidth: 640,
          width: "100%",
          // Subtle tilt
          transform: "rotate(-1.2deg)",
        }}
        whileHover={{ rotate: 0, transition: { duration: 0.3 } }}
      >
        {/* Image area */}
        <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", position: "relative", overflow: "hidden" }}>
          {children}
        </div>

        {/* Polaroid bottom panel */}
        <div className="w-full pt-3 pb-1 flex flex-col items-center gap-1">
          {signature ? (
            <img src={signature} alt="signature" style={{ height: 36, opacity: 0.7 }} />
          ) : (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#8a7a6a", letterSpacing: "0.1em" }}>
              — Director&apos;s Palette —
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (frameType === "film") {
    // Film strip with sprocket holes on top and bottom
    const HOLES = Array.from({ length: 8 });
    return (
      <div
        className={`w-full max-w-3xl ${base}`}
        style={{ background: "#111", padding: "0", overflow: "hidden" }}
      >
        {/* Top sprocket strip */}
        <div className="flex items-center" style={{ height: 28, background: "#0a0a0a", paddingInline: 6 }}>
          {HOLES.map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div style={{ width: 10, height: 16, borderRadius: 2, background: "#2a2a2a", border: "1px solid #1a1a1a" }} />
            </div>
          ))}
        </div>

        {/* Image */}
        <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", position: "relative", overflow: "hidden" }}>
          {children}
        </div>

        {/* Bottom sprocket strip */}
        <div className="flex items-center justify-between px-2" style={{ height: 28, background: "#0a0a0a" }}>
          {HOLES.map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div style={{ width: 10, height: 16, borderRadius: 2, background: "#2a2a2a", border: "1px solid #1a1a1a" }} />
            </div>
          ))}
        </div>

        {/* Film info strip */}
        <div className="flex items-center justify-between px-4 py-1" style={{ background: "#0a0a0a" }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3a3a3a", letterSpacing: "0.2em" }}>
            DIRECTORS PALETTE
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3a3a3a", letterSpacing: "0.2em" }}>
            KODAK 5219 · 35mm
          </span>
        </div>
      </div>
    );
  }

  if (frameType === "letterbox") {
    return (
      <div
        className={`w-full max-w-3xl overflow-hidden ${base}`}
        style={{ background: "#000", border: "1px solid var(--border)" }}
      >
        {/* Top bar */}
        <div style={{ height: 40, background: "#000" }} />
        {/* Image at 2.39:1 aspect */}
        <div style={{ width: "100%", aspectRatio: "2.39/1", position: "relative", overflow: "hidden" }}>
          {children}
        </div>
        {/* Bottom bar with info */}
        <div className="flex items-center justify-between px-6" style={{ height: 40, background: "#000" }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#333", letterSpacing: "0.2em" }}>
            2.39 : 1
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#333", letterSpacing: "0.2em" }}>
            DIRECTOR&apos;S PALETTE
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
