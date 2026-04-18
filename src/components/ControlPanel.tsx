"use client";

import React from "react";
import { ControlState, DEFAULT_CONTROLS } from "@/types";
import { RotateCcw } from "lucide-react";

interface ControlPanelProps {
  controls: ControlState;
  onChange: (key: keyof ControlState, value: number | boolean) => void;
  onReset: () => void;
}

type SliderDef = { id: keyof ControlState; label: string; min: number; max: number };

const GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: "Light",
    sliders: [
      { id: "intensity",   label: "Blend",      min: 0,    max: 100 },
      { id: "exposure",    label: "Exposure",   min: -100, max: 100 },
      { id: "contrast",    label: "Contrast",   min: -100, max: 100 },
      { id: "highlights",  label: "Highlights", min: -100, max: 100 },
      { id: "shadows",     label: "Shadows",    min: -100, max: 100 },
    ],
  },
  {
    title: "Color",
    sliders: [
      { id: "temperature", label: "Temperature", min: -100, max: 100 },
      { id: "tint",        label: "Tint",        min: -100, max: 100 },
      { id: "vibrance",    label: "Vibrance",    min: -100, max: 100 },
      { id: "saturation",  label: "Saturation",  min: -100, max: 100 },
    ],
  },
];

export default function ControlPanel({ controls, onChange, onReset }: ControlPanelProps) {
  let isDefault = true;
  for (const g of GROUPS) {
    for (const s of g.sliders) {
      if (controls[s.id] !== DEFAULT_CONTROLS[s.id]) { isDefault = false; break; }
    }
  }
  if (controls.skinToneProtection !== DEFAULT_CONTROLS.skinToneProtection) isDefault = false;

  return (
    <section className="flex flex-col h-full" id="control-panel" style={{ gap: 0 }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{
        borderBottom: "1px solid var(--border)"
      }}>
        <span className="hand-label" style={{ color: "var(--text-secondary)" }}>Adjustments</span>
        <button
          onClick={onReset}
          disabled={isDefault}
          className="tape-btn tape-btn-small"
          title="Reset all"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Skin protection toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-1)"
      }}>
        <span className="hand-label text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          Skin Protection
        </span>
        <button
          onClick={() => onChange("skinToneProtection", !controls.skinToneProtection)}
          className="relative flex-shrink-0"
          style={{
            width: 36, height: 20,
            background: controls.skinToneProtection ? "var(--accent)" : "var(--surface-4)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            transition: "background 0.2s ease",
            cursor: "pointer"
          }}
        >
          <span style={{
            position: "absolute",
            top: 3, left: controls.skinToneProtection ? 18 : 3,
            width: 12, height: 12,
            background: controls.skinToneProtection ? "#0f0f11" : "var(--text-tertiary)",
            borderRadius: "50%",
            transition: "left 0.2s ease"
          }} />
        </button>
      </div>

      {/* Slider groups */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {GROUPS.map((group, gIdx) => (
          <div
            key={group.title}
            style={{ borderBottom: gIdx < GROUPS.length - 1 ? "1px solid var(--border)" : "none" }}
          >
            {/* Group label */}
            <div className="px-4 pt-4 pb-2">
              <span className="hand-label text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                {group.title}
              </span>
            </div>

            {/* Sliders */}
            <div className="px-4 pb-4 flex flex-col gap-4">
              {group.sliders.map((slider) => {
                const value = controls[slider.id] as number;
                const isChanged = value !== (DEFAULT_CONTROLS[slider.id] as number);
                // Compute fill % for the range track
                const range = slider.max - slider.min;
                const pct = ((value - slider.min) / range) * 100;

                return (
                  <div key={slider.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-[11px]"
                        style={{
                          fontFamily: "monospace",
                          color: isChanged ? "var(--foreground)" : "var(--text-secondary)"
                        }}
                      >
                        {slider.label}
                      </label>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{
                          fontFamily: "monospace",
                          color: isChanged ? "var(--accent)" : "var(--text-tertiary)"
                        }}
                      >
                        {value > 0 && slider.min < 0 ? "+" : ""}{value}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      value={value}
                      onChange={(e) => onChange(slider.id, Number(e.target.value))}
                      className="w-full"
                      // CSS custom property for the progressive fill
                      style={{ "--val": `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
