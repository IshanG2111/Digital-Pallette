"use client";

import React from "react";
import { motion } from "framer-motion";

interface ChalkLoaderProps {
  progress?: number;
  message?: string;
}

export default function ChalkLoader({ progress = 0, message = "PROCESSING" }: ChalkLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8">
      {/* Abstract kinetic shape */}
      <motion.div 
        className="relative w-[1px] bg-accent"
        initial={{ height: 0 }}
        animate={{ height: 100 }}
        transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
      />

      <div className="flex flex-col items-center gap-2">
        <span className="font-serif text-5xl font-light text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
          {Math.round(progress)}
        </span>
        
        <p className="micro-label" style={{ opacity: 0.5 }}>
          {message}
        </p>
      </div>
    </div>
  );
}
