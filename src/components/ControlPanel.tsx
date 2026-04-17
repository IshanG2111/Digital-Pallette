"use client";

import React from "react";
import { ControlState, DEFAULT_CONTROLS } from "@/types";
import {
  SlidersHorizontal,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  RotateCcw,
} from "lucide-react";

interface ControlPanelProps {
  controls: ControlState;
  onChange: (key: keyof ControlState, value: number) => void;
  onReset: () => void;
}

const SLIDERS: {
  id: keyof ControlState;
  label: string;
  icon: React.ElementType;
  min: number;
  max: number;
  unit: string;
}[] = [
  { id: "intensity", label: "Intensity", icon: Sun, min: 0, max: 100, unit: "%" },
  { id: "contrast", label: "Contrast", icon: Contrast, min: -100, max: 100, unit: "" },
  { id: "saturation", label: "Saturation", icon: Droplets, min: -100, max: 100, unit: "" },
  { id: "temperature", label: "Temperature", icon: Thermometer, min: -100, max: 100, unit: "" },
];

export default function ControlPanel({
  controls,
  onChange,
  onReset,
}: ControlPanelProps) {
  const isDefault =
    controls.intensity === DEFAULT_CONTROLS.intensity &&
    controls.contrast === DEFAULT_CONTROLS.contrast &&
    controls.saturation === DEFAULT_CONTROLS.saturation &&
    controls.temperature === DEFAULT_CONTROLS.temperature;

  return (
    <section className="flex flex-col gap-3" id="control-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Adjustments
        </h2>
        <button
          onClick={onReset}
          disabled={isDefault}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            isDefault
              ? "text-white/20 cursor-not-allowed"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
          aria-label="Reset all adjustments"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="glass-panel rounded-xl p-4 flex flex-col gap-5">
        {SLIDERS.map((slider) => {
          const Icon = slider.icon;
          const value = controls[slider.id];
          const fillPct =
            ((value - slider.min) / (slider.max - slider.min)) * 100;
          const isNonDefault = value !== DEFAULT_CONTROLS[slider.id];

          return (
            <div key={slider.id} className="flex flex-col gap-2 group">
              {/* Label row */}
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-xs font-medium text-white/60 group-hover:text-white/80 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />
                  {slider.label}
                </span>
                <button
                  onClick={() => onChange(slider.id, DEFAULT_CONTROLS[slider.id])}
                  className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                    isNonDefault
                      ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                      : "bg-white/5 text-white/40 cursor-default"
                  }`}
                >
                  {value > 0 && slider.min < 0 ? "+" : ""}
                  {value}
                  {slider.unit}
                </button>
              </div>

              {/* Slider track */}
              <div className="relative flex items-center h-5">
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  value={value}
                  onChange={(e) =>
                    onChange(slider.id, parseInt(e.target.value, 10))
                  }
                  className="w-full relative z-10"
                />
                {/* Fill bar behind the native track */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-primary/60 to-primary pointer-events-none transition-all duration-75"
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
