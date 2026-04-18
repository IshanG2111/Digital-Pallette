"use client";

import React from "react";

interface LadderLoaderProps {
  progress: number; // 0-100
  message?: string;
}

/**
 * The "Ladder to the Stars" loader — a hand-drawn SVG ladder
 * reaching into a dark oval portal. Stars populate as progress fills.
 */
export default function LadderLoader({ progress, message }: LadderLoaderProps) {
  const starCount = Math.floor((progress / 100) * 12);

  // Generate star positions in the dark oval
  const stars = Array.from({ length: 12 }, (_, i) => ({
    cx: 80 + Math.cos(i * 0.52 + 1) * 45,
    cy: 22 + Math.sin(i * 0.78 + 2) * 12,
    visible: i < starCount,
    delay: i * 0.12,
  }));

  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
      <svg
        viewBox="0 0 160 120"
        width="200"
        height="150"
        className="animate-ladder"
        style={{ filter: "drop-shadow(2px 2px 0 rgba(44,36,24,0.1))" }}
      >
        {/* The Dark Portal (oval) */}
        <ellipse
          cx="80" cy="28" rx="55" ry="20"
          fill="#1a1612"
          stroke="#3d352a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="3 2"
        />

        {/* Stars inside the portal */}
        {stars.map((star, i) => (
          <g key={i}>
            {star.visible && (
              <>
                <line x1={star.cx - 3} y1={star.cy} x2={star.cx + 3} y2={star.cy}
                  stroke="#f5f0e8" strokeWidth="1.5" strokeLinecap="round"
                  style={{ animation: `starTwinkle 1.5s ${star.delay}s ease-in-out infinite` }}
                />
                <line x1={star.cx} y1={star.cy - 3} x2={star.cx} y2={star.cy + 3}
                  stroke="#f5f0e8" strokeWidth="1.5" strokeLinecap="round"
                  style={{ animation: `starTwinkle 1.5s ${star.delay}s ease-in-out infinite` }}
                />
              </>
            )}
          </g>
        ))}

        {/* The Ladder */}
        {/* Left rail */}
        <line x1="72" y1="35" x2="72" y2="115" stroke="#3d352a" strokeWidth="2.5" strokeLinecap="round" />
        {/* Right rail */}
        <line x1="88" y1="35" x2="88" y2="115" stroke="#3d352a" strokeWidth="2.5" strokeLinecap="round" />
        {/* Rungs */}
        {[45, 55, 65, 75, 85, 95, 105].map((y, i) => (
          <line key={i} x1="72" y1={y} x2="88" y2={y}
            stroke="#3d352a" strokeWidth="2" strokeLinecap="round"
          />
        ))}

        {/* Shadow under ladder */}
        <ellipse cx="80" cy="116" rx="14" ry="3" fill="rgba(44,36,24,0.15)" />
      </svg>

      {/* Progress text */}
      <div className="text-center">
        <p className="text-xs font-hand text-muted tracking-wide">
          {message || "Climbing the color ladder..."}
        </p>
        <p className="text-lg font-hand text-foreground mt-1">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}
