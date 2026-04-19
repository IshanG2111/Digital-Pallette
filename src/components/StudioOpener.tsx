"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Aperture } from "lucide-react";

interface StudioOpenerProps {
  onComplete: () => void;
}

export default function StudioOpener({ onComplete }: StudioOpenerProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleStart = () => {
    setIsClosing(true);
    setTimeout(onComplete, 1500); 
  };

  return (
    <AnimatePresence>
      {!isClosing && (
        <motion.div
          key="opener"
          className="fixed inset-0 z-[500] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "var(--background)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
        >
          {/* Majestic ambient lighting */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.03] blur-[100px] pointer-events-none" 
               style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }} />

          <div className="flex flex-col items-center z-10 text-center max-w-4xl px-8">
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.5, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
              className="mb-12"
            >
              <Aperture className="w-12 h-12 text-accent opacity-50 mx-auto mb-8 animate-spin-slow" strokeWidth={1} />
              
              <h1 className="font-serif text-6xl md:text-8xl font-light mb-8 leading-[1.1] tracking-tight">
                The Architect of <br/><span className="text-accent italic">Light & Color</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.5, delay: 0.8, ease: [0.19, 1, 0.22, 1] }}
              className="flex flex-col items-center"
            >
              <p className="font-serif text-xl md:text-2xl opacity-60 max-w-2xl leading-relaxed mb-16 italic">
                "We do not merely capture an image; we dictate the geometry of its mood, rewriting the chromosomal structure of its palette."
              </p>

              <button
                onClick={handleStart}
                className="group relative flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-accent blur-[20px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000" />
                <span className="text-[11px] md:text-[13px] font-bold uppercase tracking-[0.4em] px-12 py-6 border border-white/10 hover:border-accent/50 hover:bg-white/5 transition-all duration-700">
                  Let's start this journey
                </span>
                
                {/* Micro animations on hover */}
                <div className="absolute top-0 left-0 w-2 h-[1px] bg-accent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                <div className="absolute top-0 left-0 w-[1px] h-2 bg-accent scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500" />
                
                <div className="absolute bottom-0 right-0 w-2 h-[1px] bg-accent scale-x-0 group-hover:scale-x-100 origin-right transition-transform duration-500" />
                <div className="absolute bottom-0 right-0 w-[1px] h-2 bg-accent scale-y-0 group-hover:scale-y-100 origin-bottom transition-transform duration-500" />
              </button>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
