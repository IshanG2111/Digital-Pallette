# Director's Palette

> **A professional-grade, browser-native cinematic color grading workstation.**  
> Extract color DNA from reference footage, apply real-time WebGL-powered grades to your images, and export with cinematic polish.

---

## Overview

Director's Palette is a 4-act sequential color grading tool built entirely in the browser — no server, no uploads, no subscriptions. Drop a source video or image, extract its color palette, apply a real-time GPU grade to a target image, and export a finished print or a production-ready `.CUBE` LUT.

The interface is inspired by professional tools like DaVinci Resolve and Capture One — a dark, cinema-grade workstation with warm amber accents and tight monospace typography.

---

## The 4-Act Workflow

### Act 1 — Ingest
Drop a **source** hero image or video clip. This is your color reference — the film, photograph, or frame whose mood and palette you want to transfer.

### Act 2 — Alchemy
The source is analyzed pixel-by-pixel using a fast K-means color extraction algorithm running in a **Web Worker**. Dominant colors are extracted into a **Color DNA strip** and matched against a library of cinematic preset palettes.

### Act 3 — Darkroom
Drop your **target** image — the photo or frame you want to grade. A real-time **WebGL fragment shader** applies your chosen palette and adjustments directly on the GPU. A wipe slider lets you compare Raw vs Graded at any position. Use the collapsible **Palettes** and **Adjustments** panels from the bottom toolbar.

### Act 4 — Master
The final graded image is presented with full control over:
- **Frame style** — None, Polaroid, Film strip (sprocket holes), or Letterbox (2.39:1)
- **Director's Signature** — draw your signature on the canvas
- **Export** — download the graded image at its original resolution, or export a `.CUBE` LUT for use in Premiere, DaVinci, or Final Cut

---

## Features

| Feature | Detail |
|---|---|
| **Real-time WebGL grading** | Full DSP pipeline in a GLSL fragment shader — exposure, contrast, highlights, shadows, temperature, tint, saturation, vibrance, skin tone protection |
| **Color DNA extraction** | K-means bucketing on the GPU to find dominant palette colors from any image or video |
| **Before/After wipe** | Resolution-aware split-screen comparison slider — tracks the actual rendered image bounds regardless of aspect ratio |
| **Histogram matching** | Per-channel statistical transfer from source to target for accurate palette DNA matching |
| **Palette library** | 14+ cinematic preset palettes (Blade Runner 2049, Mad Max, Neon Noir, Teal & Orange, etc.) plus the extracted source DNA |
| **Frame presets** | None · Polaroid · Film strip · Letterbox (2.39:1) |
| **LUT export** | Generates a production-ready `.CUBE` LUT file from current grade settings |
| **Full resolution export** | Outputs at the original uploaded image resolution — not the display size |
| **Signature pad** | Hand-sign the final print using the canvas drawing pad |
| **Sound design** | Synthesized chalk snap, eraser swipe, and shutter sounds via Web Audio API |
| **Zero dependencies on media** | Runs entirely client-side — no uploads, no cloud |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Rendering | WebGL 1.0 — custom GLSL vertex + fragment shaders |
| Animations | Framer Motion |
| Color extraction | Web Worker + K-means bucketing |
| Histogram matching | Web Worker → uniform transfer to WebGL |
| Typography | Geist Mono (UI) + Architects Daughter (display) |
| Styling | Tailwind CSS v4 + CSS custom properties design system |
| Audio | Web Audio API — zero external assets |
| Icons | Lucide React |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

```bash
# Production build
npm run build
npm start
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Main 4-act application shell
│   ├── layout.tsx         # Root layout with font configuration
│   └── globals.css        # Design system — tokens, panels, buttons, sliders
├── components/
│   ├── WebGLRenderer.tsx  # GPU shader pipeline + wipe comparison
│   ├── ControlPanel.tsx   # Adjustment sliders (collapsible panel)
│   ├── PaletteSelector.tsx # Palette library + DNA selector
│   ├── FramedImage.tsx    # Frame presets (Polaroid, Film, Letterbox, None)
│   ├── SmpteLoader.tsx    # SMPTE color bar loading state
│   ├── ChalkLoader.tsx    # Circular progress loader
│   ├── StudioOpener.tsx   # Animated intro sequence
│   ├── ImageUploader.tsx  # Drag-and-drop media uploader
│   ├── SignaturePad.tsx   # Canvas signature drawing
│   └── VideoBarcodeRenderer.tsx # Video frame barcode timeline
├── hooks/
│   └── useUISound.ts      # Web Audio API sound engine
├── lib/
│   ├── colorEngine.ts     # LUT generation + channel stats
│   ├── constants.ts       # Preset palette definitions
│   └── workers/
│       └── histogramWorker.ts # Off-thread pixel analysis
└── types/
    └── index.ts           # Shared TypeScript types
```

---

## Design System

The UI is built around a **Cinema Dark** design system with a 4-layer surface hierarchy:

```
--background  #0f0f11   Void — deepest layer
--surface-1   #141416   App shell, header
--surface-2   #1a1a1e   Panels, drawers
--surface-3   #222228   Cards, inputs
--surface-4   #2a2a32   Hover states
```

**Primary accent:** `#d4a853` (warm amber — film grain warmth)  
**Secondary accent:** `#4ec9b0` (cool teal — digital precision)

---

## License

MIT — build something cinematic.
