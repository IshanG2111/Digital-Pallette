"use client";

import React from "react";
import { motion } from "framer-motion";

interface ChalkLoaderProps {
  progress?: number;
  message?: string;
}

export default function ChalkLoader({ progress = 0, message = "Processing..." }: ChalkLoaderProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-5 p-8">
      {/* Circular progress ring */}
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Background track */}
        <svg viewBox="0 0 90 90" className="absolute inset-0 w-full h-full">
          <circle
            cx="45" cy="45" r={radius}
            fill="none"
            stroke="rgba(58,58,72,1)"
            strokeWidth="2"
          />
        </svg>

        {/* Progress arc */}
        <svg
          viewBox="0 0 90 90"
          className="absolute inset-0 w-full h-full"
          style={{ transform: "rotate(-90deg)" }}
        >
          <motion.circle
            cx="45" cy="45" r={radius}
            fill="none"
            stroke="#d4a853"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        </svg>

        {/* Amber glow when active */}
        {progress > 5 && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(212,168,83,0.05) 0%, transparent 70%)",
            }}
          />
        )}

        {/* Center percentage */}
        <div className="relative flex flex-col items-center">
          <span className="text-lg font-medium tabular-nums" style={{ 
            fontFamily: "monospace", color: "#e8e8ea", lineHeight: 1 
          }}>
            {Math.round(progress)}
          </span>
          <span className="text-[9px]" style={{ color: "#5a5a68" }}>%</span>
        </div>
      </div>

      {/* Status message */}
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.15em]" style={{ 
          fontFamily: "monospace", color: "#a0a0aa"
        }}>
          {message}
        </p>

        {/* Animated dots indicator */}
        <div className="flex gap-1 justify-center mt-3">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ background: "#d4a853" }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
