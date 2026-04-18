"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LadderLoader from "./LadderLoader";
import { useUISound } from "@/hooks/useUISound";

interface ClapboardOpenerProps {
  onComplete: () => void;
}

/**
 * The Opening Sequence — "The First Frame"
 * Phase A: Charcoal void → Logo + Ladder → "PREPARING THE CELLULOID..."
 * Phase B: Clapperboard slides in → SNAPS shut → Big Bang dissolve into app
 */
export default function ClapboardOpener({ onComplete }: ClapboardOpenerProps) {
  const [phase, setPhase] = useState<"warmup" | "ladder" | "snap" | "bang" | "done">("warmup");
  const [ladderProgress, setLadderProgress] = useState(0);
  const { playSlateClap, playProjectorHum } = useUISound();

  // Phase A: warmup → ladder
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase("ladder");
      playProjectorHum();
    }, 800);
    return () => clearTimeout(t1);
  }, [playProjectorHum]);

  // Phase A: ladder progress
  useEffect(() => {
    if (phase !== "ladder") return;
    const interval = setInterval(() => {
      setLadderProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setPhase("snap"), 400);
          return 100;
        }
        return p + 4;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase B: snap → bang → done
  useEffect(() => {
    if (phase !== "snap") return;
    playSlateClap();
    const t = setTimeout(() => setPhase("bang"), 350);
    return () => clearTimeout(t);
  }, [phase, playSlateClap]);

  useEffect(() => {
    if (phase !== "bang") return;
    const t = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 600);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  if (phase === "done") return null;

  return (
    <motion.div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: "#1a1612" }}
      animate={phase === "bang" ? { scale: 8, opacity: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Paper grain overlay even on boot */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "200px 200px",
      }} />

      <AnimatePresence mode="wait">
        {/* Phase A: Warmup + Ladder */}
        {(phase === "warmup" || phase === "ladder") && (
          <motion.div
            key="warmup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-6"
          >
            {/* Glowing logo */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-center"
            >
              <h1 className="font-hand text-3xl md:text-5xl text-chalk-white tracking-wide"
                style={{
                  textShadow: "0 0 30px rgba(197,165,90,0.4), 0 0 60px rgba(197,165,90,0.15)",
                  transform: "rotate(-1.5deg)",
                }}
              >
                Director&apos;s Palette
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.7, 1] }}
                transition={{ delay: 0.8, duration: 1.5, repeat: Infinity }}
                className="font-hand text-xs md:text-sm tracking-[0.3em] mt-4"
                style={{ color: "#8b7d6b" }}
              >
                PREPARING THE CELLULOID...
              </motion.p>
            </motion.div>

            {/* Ladder */}
            {phase === "ladder" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <LadderLoader progress={ladderProgress} message="Scanning the emulsion..." />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Phase B: The Clapperboard */}
        {phase === "snap" && (
          <motion.div
            key="clap"
            initial={{ scale: 0.5, opacity: 0, rotate: -5 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex flex-col items-center"
          >
            {/* Clapperboard SVG */}
            <svg viewBox="0 0 320 220" width="400" height="280" className="drop-shadow-2xl">
              {/* Board body */}
              <rect x="10" y="70" width="300" height="140" rx="4"
                fill="#1a1612" stroke="#3d352a" strokeWidth="3" strokeDasharray="5 3" strokeLinecap="round" />

              {/* Clapper top (the snapping piece) */}
              <motion.g
                initial={{ rotate: 0 }}
                animate={{ rotate: -25 }}
                transition={{ duration: 0.15, ease: "easeIn" }}
                style={{ originX: "10px", originY: "70px", transformOrigin: "10px 70px" }}
              >
                <polygon
                  points="10,70 310,70 310,30 10,30"
                  fill="#2c2418" stroke="#3d352a" strokeWidth="3" strokeLinecap="round"
                />
                {/* Diagonal stripes */}
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <rect key={i} x={30 + i * 42} y="30" width="20" height="40" fill="#f5f0e8" opacity="0.9" />
                ))}
              </motion.g>

              {/* Board text */}
              <text x="160" y="120" textAnchor="middle" fill="#f0ece4"
                fontFamily="var(--font-hand), cursive" fontSize="18" letterSpacing="0.15em">
                DIRECTOR&apos;S PALETTE
              </text>
              <text x="160" y="150" textAnchor="middle" fill="#8b7d6b"
                fontFamily="var(--font-hand), cursive" fontSize="12" letterSpacing="0.2em">
                SCENE 1 — TAKE 1
              </text>

              {/* PLEASE STAND BACK tape strip */}
              <rect x="40" y="170" width="240" height="28" rx="2" fill="#1a1612"
                clipPath="url(#tapeClip)" />
              <text x="160" y="189" textAnchor="middle" fill="#f0ece4"
                fontFamily="var(--font-hand), cursive" fontSize="11" letterSpacing="0.12em">
                PLEASE STAND BACK
              </text>
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
