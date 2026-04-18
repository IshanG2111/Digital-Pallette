"use client";

import { useCallback, useRef } from "react";

/**
 * The Premium Chalkboard Workstation Sound Engine
 * Chalk snaps, blackboard writing, and eraser wipes.
 * All synthesized via Web Audio API — zero external assets.
 */
export function useUISound() {
  const context = useRef<AudioContext | null>(null);

  const initContext = () => {
    if (!context.current) {
      context.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (context.current.state === "suspended") {
      context.current.resume();
    }
  };

  // Chalk Writing — scratchy noise burst with rapid pitch modulation
  const playCrinkle = useCallback(() => {
    initContext();
    const ctx = context.current;
    if (!ctx) return;

    const dur = 0.15;
    const bufLen = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      // Chalk friction noise
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.4 ? 1 : 0.2);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.setValueAtTime(4000, ctx.currentTime);
    bp.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }, []);

  // Eraser Swipe
  const playProjectorHum = useCallback(() => {
    initContext();
    const ctx = context.current;
    if (!ctx) return;

    const dur = 0.6;
    const bufLen = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to sound like felt eraser
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(800, ctx.currentTime);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + dur);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }, []);

  // Chalk Snap — sharp transient click
  const playSlateClap = useCallback(() => {
    initContext();
    const ctx = context.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(3000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  // Short tap for dragging/dropping or UI clicks
  const playScratch = useCallback(() => {
    initContext();
    const ctx = context.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }, []);

  // Camera shutter sound
  const playShutter = useCallback(() => {
    initContext();
    const ctx = context.current;
    if (!ctx) return;

    // Fast mechanical click
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  return { playCrinkle, playProjectorHum, playSlateClap, playScratch, playShutter };
}
