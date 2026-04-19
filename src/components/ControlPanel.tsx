"use client";

import React from "react";
import { ControlState, DEFAULT_CONTROLS } from "@/types";
import { RotateCcw } from "lucide-react";

interface ControlPanelProps {
  controls: ControlState;
  onChange: (key: keyof ControlState, value: number | boolean) => void;
  onReset: () => void;
  onAutoGrade?: () => void;
}

type SliderDef = { id: keyof ControlState; label: string; min: number; max: number };

const GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: "LIGHT",
    sliders: [
      { id: "intensity",   label: "Blend",      min: 0,    max: 100 },
      { id: "exposure",    label: "Exposure",   min: -100, max: 100 },
      { id: "contrast",    label: "Contrast",   min: -100, max: 100 },
      { id: "highlights",  label: "Highlights", min: -100, max: 100 },
      { id: "shadows",     label: "Shadows",    min: -100, max: 100 },
    ],
  },
  {
    title: "COLOR",
    sliders: [
      { id: "temperature", label: "Temperature", min: -100, max: 100 },
      { id: "tint",        label: "Tint",        min: -100, max: 100 },
      { id: "vibrance",    label: "Vibrance",    min: -100, max: 100 },
      { id: "saturation",  label: "Saturation",  min: -100, max: 100 },
    ],
  },
];

export default function ControlPanel({ controls, onChange, onReset, onAutoGrade }: ControlPanelProps) {
  let isDefault = true;
  for (const g of GROUPS) {
    for (const s of g.sliders) {
      if (controls[s.id] !== DEFAULT_CONTROLS[s.id]) { isDefault = false; break; }
    }
  }
  if (controls.skinToneProtection !== DEFAULT_CONTROLS.skinToneProtection) isDefault = false;

  return (
    <section className="flex flex-col h-full bg-transparent overflow-hidden px-10 py-12" id="control-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-10 flex-shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-text-secondary">ADJUSTMENTS</span>
        <div className="flex items-center gap-6">
          {onAutoGrade && (
            <button
              onClick={onAutoGrade}
              className="uppercase font-bold tracking-[0.3em] text-[10px] text-accent hover:text-white transition-colors"
              title="Auto Match DNA"
            >
              [ AUTO GRADE ]
            </button>
          )}
          <button
            onClick={onReset}
            disabled={isDefault}
            className="uppercase font-bold tracking-[0.3em] text-[10px] text-text-secondary hover:text-foreground transition-colors disabled:opacity-30"
            title="Reset all"
          >
            [ RESET ]
          </button>
        </div>
      </div>

      <div className="w-full h-[1px] bg-white/10 mb-10" />

      {/* Skin protection toggle */}
      <div className="flex items-center justify-between pb-10 flex-shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-secondary">SKIN PROTECTION</span>
        <button
          onClick={() => onChange("skinToneProtection", !controls.skinToneProtection)}
          className="relative flex-shrink-0 flex items-center justify-center"
          style={{ width: 32, height: 16 }}
        >
          {/* Hairline track */}
          <div className="absolute inset-x-0 h-px bg-border" />
          {/* Thumb */}
          <span style={{
            position: "absolute",
            top: 2, left: controls.skinToneProtection ? 20 : 0,
            width: 12, height: 12,
            background: controls.skinToneProtection ? "var(--foreground)" : "var(--text-tertiary)",
            transition: "left 0.4s cubic-bezier(0.19, 1, 0.22, 1), background 0.4s ease"
          }} />
        </button>
      </div>

      {/* Slider groups */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {GROUPS.map((group, gIdx) => (
          <div key={group.title} className="mb-14">
            <h4 className="text-[12px] font-bold tracking-[0.4em] mb-8 text-foreground/40">{group.title}</h4>
            <div className="flex flex-col gap-8">
              {group.sliders.map((slider) => {
                const value = controls[slider.id] as number;
                const isChanged = value !== (DEFAULT_CONTROLS[slider.id] as number);

                return (
                  <div key={slider.id} className="flex flex-col gap-3 relative group">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-500"
                        style={{
                          color: isChanged ? "var(--foreground)" : "var(--text-secondary)"
                        }}
                      >
                        {slider.label}
                      </label>
                      <span
                        className="text-[12px] font-bold tabular-nums tracking-widest transition-colors duration-500"
                        style={{
                          color: isChanged ? "var(--accent)" : "var(--text-tertiary)"
                        }}
                      >
                        {value > 0 && slider.min < 0 ? "+" : ""}{value}
                      </span>
                    </div>
                    {/* The slider itself relies on globals.css minimal styling */}
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      value={value}
                      onChange={(e) => onChange(slider.id, Number(e.target.value))}
                      className="w-full opacity-50 group-hover:opacity-100 transition-opacity duration-500"
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
