"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Palette, ControlState } from "@/types";

import type { ChannelStats } from "@/lib/workers/histogramWorker";

interface WebGLRendererProps {
  imageUrl: string | null;
  palette: Palette | null;
  controls: ControlState;
  sourceStats?: ChannelStats | null;
  wipeEnabled?: boolean; // false = always show fully graded, no divider
}

// ─── Vertex Shader ───────────────────────────────────────────────────────────
const VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    // flip Y so canvas top = image top
    v_uv = vec2(a_pos.x * 0.5 + 0.5, 1.0 - (a_pos.y * 0.5 + 0.5));
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

// ─── Fragment Shader (Full DSP Pipeline) ────────────────────────────────────
const FRAG = `
  precision highp float;

  uniform sampler2D u_image;
  uniform float u_wipe_x;      // 0.0–1.0, left = original, right = graded
  uniform float u_exposure;    // –5 to +5 (EV stops)
  uniform float u_contrast;    // 0.5 to 2.0 (multiplier)
  uniform float u_highlights;  // –1.0 to +1.0
  uniform float u_shadows;     // –1.0 to +1.0
  uniform float u_temperature; // –1.0 to +1.0 (warm/cool)
  uniform float u_tint;        // –1.0 to +1.0 (magenta/green)
  uniform float u_saturation;  // 0.0 to 2.0
  uniform float u_vibrance;    // –1.0 to +1.0
  uniform float u_intensity;   // 0.0 to 1.0 (palette blend)
  uniform bool  u_skin_protect;

  // Palette (up to 5 colors, pre-normalized to 0–1)
  uniform vec3 u_p0;
  uniform vec3 u_p1;
  uniform vec3 u_p2;
  uniform vec3 u_p3;
  uniform vec3 u_p4;

  // Histogram transfer (source stats)
  uniform vec3 u_src_mean;   // [rMean, gMean, bMean] / 255
  uniform vec3 u_src_std;    // [rStd,  gStd,  bStd]  / 255
  uniform vec3 u_tgt_mean;
  uniform vec3 u_tgt_std;
  uniform bool u_histogram_match;

  varying vec2 v_uv;

  // ── sRGB ↔ Linear ──────────────────────────────────────────────────────────
  float toLinear(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
  }
  float toSRGB(float c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(max(c, 0.0), 1.0 / 2.4) - 0.055;
  }
  vec3 linearize(vec3 c) { return vec3(toLinear(c.r), toLinear(c.g), toLinear(c.b)); }
  vec3 delinearize(vec3 c) { return vec3(toSRGB(c.r), toSRGB(c.g), toSRGB(c.b)); }

  // ── RGB ↔ HSV ──────────────────────────────────────────────────────────────
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // ── Luma coefficient (BT.709) ────────────────────────────────────────────
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    vec4 texColor = texture2D(u_image, v_uv);
    vec3 orig = texColor.rgb;

    // ── Before/After Wipe ──────────────────────────────────────────────────
    if (v_uv.x < u_wipe_x) {
      gl_FragColor = vec4(orig, 1.0);
      return;
    }

    vec3 col = orig;

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 1: Input Transform – sRGB → Linear
    // ───────────────────────────────────────────────────────────────────────
    col = linearize(col);

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 2: Primary Adjustments
    // ───────────────────────────────────────────────────────────────────────

    // Exposure: I_out = I_in × 2^EV
    col *= pow(2.0, u_exposure);

    // Contrast: pivot around 0.5 in linear light
    col = (col - 0.5) * u_contrast + 0.5;

    // White Balance – Temperature
    // Warm +: push red/amber, pull blue
    col.r = col.r + u_temperature * 0.12;
    col.b = col.b - u_temperature * 0.12;
    // A touch of green cross-contamination for realism
    col.g = col.g + u_temperature * 0.04;

    // Tint – magenta/green axis
    col.g = col.g + u_tint * 0.08;
    col.r = col.r - u_tint * 0.03;
    col.b = col.b - u_tint * 0.03;

    col = clamp(col, 0.0, 1.0);

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 3: Secondary Adjustments
    // ───────────────────────────────────────────────────────────────────────

    float L = luma(col);

    // Highlights (only affects bright pixels)
    float hMask = smoothstep(0.45, 1.0, L);
    col = mix(col, col + (col - vec3(L)) * u_highlights * hMask,
              abs(u_highlights));
    col = col + vec3(u_highlights * 0.25 * hMask);

    // Shadows (only affects dark pixels)
    float sMask = smoothstep(0.55, 0.0, L);
    col = col + vec3(u_shadows * 0.3 * sMask);

    col = clamp(col, 0.0, 1.0);

    // Saturation (uniform adjustment)
    float L2 = luma(col);
    col = mix(vec3(L2), col, u_saturation);

    // Vibrance – smart saturation: targets desaturated pixels, skips skin
    vec3 hsv = rgb2hsv(col);
    float sat = hsv.y;

    // Skin tone: hue ~ 0.02–0.10 (reds/oranges), moderately saturated
    bool isSkin = (hsv.x > 0.02 && hsv.x < 0.10) && sat > 0.20 && hsv.z > 0.25;
    float skinFactor = (u_skin_protect && isSkin) ? 0.1 : 1.0;

    // Positive vibrance: more effect on desaturated pixels
    float vibBoost = u_vibrance * (1.0 - sat) * skinFactor;
    hsv.y = clamp(hsv.y + vibBoost, 0.0, 1.0);
    col = hsv2rgb(hsv);
    col = clamp(col, 0.0, 1.0);

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 4: Histogram Matching (Palette DNA Transfer)
    // Formula: I_new = (I - μ_target) × (σ_source / σ_target) + μ_source
    // ───────────────────────────────────────────────────────────────────────
    vec3 matched = col;
    if (u_histogram_match) {
      vec3 sigma_ratio = u_src_std / max(u_tgt_std, vec3(0.001));
      matched = (col - u_tgt_mean) * sigma_ratio + u_src_mean;
      matched = clamp(matched, 0.0, 1.0);
    }

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 4b: Luma-bucketed palette tinting (the "Color DNA" look)
    // ───────────────────────────────────────────────────────────────────────
    float finalLuma = luma(col);
    float paletteIdx = clamp(finalLuma * 5.0, 0.0, 4.999);
    int pIdx = int(floor(paletteIdx));

    vec3 paletteColor;
    if      (pIdx == 0) paletteColor = u_p0;
    else if (pIdx == 1) paletteColor = u_p1;
    else if (pIdx == 2) paletteColor = u_p2;
    else if (pIdx == 3) paletteColor = u_p3;
    else                paletteColor = u_p4;

    // Blend palette tint: preserve luminance, shift chrominance
    vec3 tinted = paletteColor * finalLuma;
    vec3 colWithPalette = mix(col, tinted, u_intensity);

    // Blend histogram-matched and palette-tinted based on intensity
    col = mix(colWithPalette, matched, u_intensity * (u_histogram_match ? 0.6 : 0.0));
    col = mix(colWithPalette, col, u_intensity);
    col = clamp(col, 0.0, 1.0);

    // ───────────────────────────────────────────────────────────────────────
    // STAGE 5: Output Transform – Linear → sRGB
    // ───────────────────────────────────────────────────────────────────────
    col = delinearize(col);
    col = clamp(col, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── WebGL Helpers ────────────────────────────────────────────────────────────
function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, createShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, createShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WebGLRenderer({
  imageUrl,
  palette,
  controls,
  sourceStats,
  wipeEnabled = true,
}: WebGLRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const targetStatsRef = useRef<ChannelStats | null>(null);
  const histWorkerRef = useRef<Worker | null>(null);

  const [wipeX, setWipeX] = useState(0.5);       // 0-1 in IMAGE UV space
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  // Tracks the rendered image's actual pixel rect within the container (letterbox-aware)
  const imageRectRef = useRef<{ left: number; width: number } | null>(null);

  // Map of uniform locations (cached after compile)
  const uRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  // ── Init WebGL + compile shader ──────────────────────────────────────────
  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) { setGlError("WebGL not supported in this browser"); return false; }
    glRef.current = gl;

    try {
      const prog = createProgram(gl, VERT, FRAG);
      progRef.current = prog;
      gl.useProgram(prog);

      // Cache uniform locations
      const uniformNames = [
        "u_image","u_wipe_x","u_exposure","u_contrast",
        "u_highlights","u_shadows","u_temperature","u_tint",
        "u_saturation","u_vibrance","u_intensity","u_skin_protect",
        "u_p0","u_p1","u_p2","u_p3","u_p4",
        "u_src_mean","u_src_std","u_tgt_mean","u_tgt_std","u_histogram_match",
      ];
      uniformNames.forEach(n => { uRef.current[n] = gl.getUniformLocation(prog, n); });

      // Fullscreen quad: 2 triangles
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1,
      ]), gl.STATIC_DRAW);

      const posLoc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      return true;
    } catch (err) {
      setGlError(String(err));
      return false;
    }
  }, []);

  // ── Upload image to GPU texture ──────────────────────────────────────────
  const uploadTexture = useCallback((img: HTMLImageElement) => {
    const gl = glRef.current;
    if (!gl) return;

    if (texRef.current) gl.deleteTexture(texRef.current);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    texRef.current = tex;

    // Extract target histogram stats
    const offCanvas = document.createElement("canvas");
    offCanvas.width = Math.min(img.naturalWidth, 256);
    offCanvas.height = Math.min(img.naturalHeight, 256);
    const ctx2d = offCanvas.getContext("2d")!;
    ctx2d.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
    const imageData = ctx2d.getImageData(0, 0, offCanvas.width, offCanvas.height);
    histWorkerRef.current?.postMessage({ imageData });
  }, []);

  // ── Render one frame via uniforms ────────────────────────────────────────
  const renderFrame = useCallback(() => {
    const gl = glRef.current;
    const prog = progRef.current;
    const u = uRef.current;
    if (!gl || !prog || !texRef.current) return;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    gl.uniform1i(u.u_image, 0);

    // Wipe: use 1.0 when disabled (show fully graded)
    gl.uniform1f(u.u_wipe_x, wipeEnabled ? wipeX : 1.0);

    // Primary
    const ev = (controls.exposure / 100) * 5;        // –5 to +5 EV
    gl.uniform1f(u.u_exposure, ev);
    gl.uniform1f(u.u_contrast, 1 + controls.contrast / 100);
    gl.uniform1f(u.u_temperature, controls.temperature / 100);
    gl.uniform1f(u.u_tint, controls.tint / 100);

    // Secondary
    gl.uniform1f(u.u_highlights, controls.highlights / 100);
    gl.uniform1f(u.u_shadows, controls.shadows / 100);
    gl.uniform1f(u.u_saturation, 1 + controls.saturation / 100);
    gl.uniform1f(u.u_vibrance, controls.vibrance / 100);
    gl.uniform1f(u.u_intensity, controls.intensity / 100);
    gl.uniform1i(u.u_skin_protect, controls.skinToneProtection ? 1 : 0);

    // Palette (pre-normalize to 0–1)
    const colors = palette?.colors ?? [];
    const getP = (i: number) => colors[i] ? [colors[i][0]/255, colors[i][1]/255, colors[i][2]/255] : [0.5,0.5,0.5];
    gl.uniform3fv(u.u_p0, getP(0));
    gl.uniform3fv(u.u_p1, getP(1));
    gl.uniform3fv(u.u_p2, getP(2));
    gl.uniform3fv(u.u_p3, getP(3));
    gl.uniform3fv(u.u_p4, getP(4));

    // Histogram matching
    const tgt = targetStatsRef.current;
    const src = sourceStats ?? null;
    const doMatch = !!(tgt && src);
    gl.uniform1i(u.u_histogram_match, doMatch ? 1 : 0);
    if (doMatch && src && tgt) {
      gl.uniform3fv(u.u_src_mean, [src.rMean/255, src.gMean/255, src.bMean/255]);
      gl.uniform3fv(u.u_src_std,  [src.rStd/255,  src.gStd/255,  src.bStd/255]);
      gl.uniform3fv(u.u_tgt_mean, [tgt.rMean/255, tgt.gMean/255, tgt.bMean/255]);
      gl.uniform3fv(u.u_tgt_std,  [tgt.rStd/255,  tgt.gStd/255,  tgt.bStd/255]);
    } else {
      gl.uniform3fv(u.u_src_mean, [0.5,0.5,0.5]);
      gl.uniform3fv(u.u_src_std,  [0.1,0.1,0.1]);
      gl.uniform3fv(u.u_tgt_mean, [0.5,0.5,0.5]);
      gl.uniform3fv(u.u_tgt_std,  [0.1,0.1,0.1]);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [controls, palette, wipeX, wipeEnabled, sourceStats]);

  // ── rAF loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  // ── Bootstrap GL on mount ────────────────────────────────────────────────
  useEffect(() => {
    // Init histogram worker
    histWorkerRef.current = new Worker(
      new URL("../lib/workers/histogramWorker.ts", import.meta.url)
    );
    histWorkerRef.current.onmessage = (e) => {
      targetStatsRef.current = e.data as ChannelStats;
    };

    initGL();
    return () => {
      histWorkerRef.current?.terminate();
      cancelAnimationFrame(rafRef.current);
    };
  }, [initGL]);

  // ── Load image when URL changes ──────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) return;
    setIsLoading(true);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;

      // Always use the native resolution of the uploaded image
      // so we export at full quality. CSS 'object-fit' handles
      // downscaling the visual representation.
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "contain";
      }

      uploadTexture(img);
      setIsLoading(false);
    };
  }, [imageUrl, uploadTexture]);

  // ── Compute the rendered image rect within container (letterbox-aware) ───
  const computeImageRect = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imgRef.current) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = imgRef.current.naturalWidth;
    const ih = imgRef.current.naturalHeight;
    if (!iw || !ih) return;

    // object-fit: contain logic
    const containerAspect = cw / ch;
    const imageAspect = iw / ih;

    let renderedW: number, renderedH: number;
    if (imageAspect > containerAspect) {
      // Pillarboxed: image fills width, letterboxed top/bottom
      renderedW = cw;
      renderedH = cw / imageAspect;
    } else {
      // Letterboxed: image fills height, pillarboxed left/right
      renderedH = ch;
      renderedW = ch * imageAspect;
    }

    const offsetX = (cw - renderedW) / 2;
    imageRectRef.current = { left: offsetX, width: renderedW };
  }, []);

  // Recompute on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => computeImageRect());
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeImageRect]);

  // Also recompute when image loads
  useEffect(() => {
    if (imgRef.current) computeImageRect();
  }, [isLoading, computeImageRect]);

  // ── Pointer handlers — wipe mapped to IMAGE space ────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerUp   = () => setIsDragging(false);
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const imgRect = imageRectRef.current;
    if (!imgRect) {
      // Fallback if not yet computed
      setWipeX(Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1)));
      return;
    }
    // Map to image-local 0-1
    const xInImg = e.clientX - rect.left - imgRect.left;
    setWipeX(Math.max(0, Math.min(xInImg / imgRect.width, 1)));
  };

  // ── Export (grab current WebGL frame) ────────────────────────────────────
  // Note: preserved via preserveDrawingBuffer: true on context creation
  // Caller can grab canvasRef.current.toDataURL("image/png")

  if (!imageUrl) {
    return (
      <div className="flex-1 w-full h-full min-h-[300px] sketch-dashed flex flex-col items-center justify-center pointer-events-none select-none">
        <p className="hand-label text-sm">GPU Renderer Ready</p>
        <p className="hand-label text-xs mt-1 opacity-50">Upload a target to paint</p>
      </div>
    );
  }

  // Wipe divider position mapped back to container-% (from image-space)
  const wipeLineLeft = imageRectRef.current
    ? imageRectRef.current.left + wipeX * imageRectRef.current.width
    : wipeX * 100; // fallback %
  const wipeLineStyle: React.CSSProperties = imageRectRef.current
    ? { left: wipeLineLeft, transform: "translateX(-50%)" }
    : { left: `${wipeX * 100}%`, transform: "translateX(-50%)" };

  return (
    <div className="flex flex-col h-full animate-fade-in" style={{ background: "var(--surface-1)" }}>
      {/* Minimal header bar */}
      <div
        className="flex justify-between items-center px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="hand-label">GPU Grade</span>
        <div className="flex items-center gap-3">
          {isLoading && <span className="hand-label" style={{ color: "var(--accent)" }}>Loading…</span>}
          {glError && <span className="text-[10px]" style={{ color: "var(--status-error)", fontFamily: "monospace" }}>{glError}</span>}
          {sourceStats && (
            <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "monospace", color: "var(--accent)" }}>
              ✓ DNA Match Active
            </span>
          )}
          <span className="hand-label">Raw / Graded</span>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full overflow-hidden select-none flex items-center justify-center"
        style={{ cursor: isDragging ? "ew-resize" : "col-resize", background: "#000" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <canvas
          ref={canvasRef}
          style={{ imageRendering: "crisp-edges", maxWidth: "100%", maxHeight: "100%" }}
        />

        {/* Wipe divider — only shown when wipeEnabled is true */}
        {wipeEnabled && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
            style={{
              ...wipeLineStyle,
              width: 1,
              background: "rgba(255,255,255,0.6)",
              boxShadow: "0 0 8px rgba(212,168,83,0.4), 1px 0 1px rgba(0,0,0,0.5)",
            }}
          >
            {/* Drag handle */}
            <div
              className="absolute top-1/2 left-1/2 flex items-center justify-center"
              style={{
                transform: "translate(-50%, -50%)",
                width: 28, height: 28,
                background: "var(--surface-3)",
                border: "1px solid var(--border-bright)",
                borderRadius: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                cursor: "ew-resize",
                pointerEvents: "all",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a0a0aa" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 4 12 9 6" />
                <polyline points="15 6 20 12 15 18" />
              </svg>
            </div>
          </div>
        )}

        {/* RAW / GRADED labels — constrained to image */}
        {imageRectRef.current && (
          <>
            <div
              className="absolute bottom-3 pointer-events-none"
              style={{
                left: imageRectRef.current.left + 8,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid var(--border)",
                padding: "2px 8px",
                borderRadius: 2,
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "#a0a0aa",
                textTransform: "uppercase",
              }}
            >
              Raw
            </div>
            <div
              className="absolute bottom-3 pointer-events-none"
              style={{
                right: imageRectRef.current.left + 8,
                background: "rgba(212,168,83,0.15)",
                border: "1px solid rgba(212,168,83,0.4)",
                padding: "2px 8px",
                borderRadius: 2,
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "#d4a853",
                textTransform: "uppercase",
              }}
            >
              Graded
            </div>
          </>
        )}
      </div>
    </div>
  );
}
