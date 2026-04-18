"use client";

import React from "react";
import { motion } from "framer-motion";

interface MovieClapperLoaderProps {
  progress?: number;
  message?: string;
}

export default function MovieClapperLoader({ progress = 0, message = "Loading..." }: MovieClapperLoaderProps) {
  // We want the clapper to snap shut repeatedly, or maybe just once when it's done? 
  // For a loader, snapping rhythmically is fun.
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <motion.div
        className="relative w-32 h-24"
        initial={{ rotate: -2 }}
        animate={{ rotate: 2 }}
        transition={{ repeat: Infinity, duration: 2, repeatType: "reverse", ease: "easeInOut" }}
      >
        {/* Board base */}
        <div className="absolute bottom-0 left-0 w-full h-[65%] bg-card border-2 border-charcoal rounded-sm shadow-sm overflow-hidden flex flex-col justify-between p-2">
          <div className="flex justify-between items-start">
            <span className="hand-label text-[10px] text-muted">SCENE</span>
            <span className="hand-label text-[10px] text-muted">TAKE</span>
          </div>
          <div className="flex justify-center text-center">
            <span className="font-hand text-lg">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Clapper base bar */}
        <div className="absolute top-[20%] left-0 w-full h-4 bg-charcoal rounded-sm" />

        {/* Snapping Arm */}
        <motion.div
          className="absolute top-[20%] left-0 w-full h-4 bg-charcoal rounded-sm border-t border-chalk-white border-opacity-20"
          style={{ originX: 0, originY: 1 }}
          animate={{ rotate: [-20, 0, -20] }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            times: [0, 0.1, 1], // snappy close, slow open
            ease: ["easeIn", "easeOut"]
          }}
        >
          {/* Stripes on arm */}
          <div className="w-full h-full flex overflow-hidden opacity-90">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-full bg-chalk-white"
                style={{ transform: "skewX(-30deg) scaleX(1.5)", marginLeft: "4px" }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>

      <div className="text-center">
        <p className="hand-label text-sm animate-pulse">{message}</p>
        <div className="w-40 h-1 mt-2 bg-charcoal rounded-full overflow-hidden mx-auto">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
}
