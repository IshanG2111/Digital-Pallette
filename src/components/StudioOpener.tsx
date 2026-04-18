"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface StudioOpenerProps {
  onComplete: () => void;
}

export default function StudioOpener({ onComplete }: StudioOpenerProps) {
  const [phase, setPhase] = useState<"intro" | "logo" | "out">("intro");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("logo"), 300);
    const t2 = setTimeout(() => setPhase("out"), 2200);
    const t3 = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "out" && (
        <motion.div
          className="fixed inset-0 z-[500] flex flex-col items-center justify-center"
          style={{ background: "#0a0a0c" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {/* Subtle grid lines */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `
              linear-gradient(rgba(212,168,83,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(212,168,83,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px"
          }} />

          <AnimatePresence>
            {phase === "logo" && (
              <motion.div
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Circular logo mark */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: "#d4a853", background: "rgba(212,168,83,0.08)" }}>
                    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                      <circle cx="16" cy="16" r="5" fill="#d4a853" opacity="0.9"/>
                      <circle cx="16" cy="16" r="10" stroke="#d4a853" strokeWidth="1" opacity="0.4"/>
                      <path d="M16 6 L16 8 M16 24 L16 26 M6 16 L8 16 M24 16 L26 16" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  {/* Outer ring animation */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ border: "1px solid #d4a853" }}
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  />
                </motion.div>

                {/* App name */}
                <div className="flex flex-col items-center gap-2">
                  <motion.h1
                    className="text-2xl font-light tracking-[0.4em] uppercase"
                    style={{ 
                      color: "#e8e8ea", 
                      fontFamily: "var(--font-mono), monospace",
                      letterSpacing: "0.4em"
                    }}
                    initial={{ opacity: 0, letterSpacing: "0.8em" }}
                    animate={{ opacity: 1, letterSpacing: "0.4em" }}
                    transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                  >
                    Director&apos;s Palette
                  </motion.h1>
                  <motion.div
                    className="h-px w-48"
                    style={{ background: "linear-gradient(90deg, transparent, #d4a853, transparent)" }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                  />
                  <motion.p
                    className="text-xs tracking-widest uppercase"
                    style={{ color: "#5a5a68", fontFamily: "monospace" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9, duration: 0.6 }}
                  >
                    Color Grading Engine
                  </motion.p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
