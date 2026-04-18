"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Film, X } from "lucide-react";
import { useUISound } from "@/hooks/useUISound";
import SmpteLoader from "./SmpteLoader";

interface MediaUploaderProps {
  onUpload: (file: File) => void;
  onClear: () => void;
  currentMediaUrl: string | null;
  mediaType: "image" | "video" | null;
}

export default function MediaUploader({
  onUpload,
  onClear,
  currentMediaUrl,
  mediaType,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playCrinkle, playSlateClap } = useUISound();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      playSlateClap();
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      playSlateClap();
      onUpload(e.target.files[0]);
    }
  };

  const hasMedia = !!currentMediaUrl;

  return (
    <section className="flex flex-col gap-3 h-full" id="media-uploader">
      <h2 className="hand-label text-sm" style={{ transform: "rotate(-1.5deg)" }}>
        <Film className="w-3.5 h-3.5 inline mr-1.5" /> The Source
      </h2>

      <div
        className={`sketch-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 flex-grow relative overflow-hidden group ${
          isDragging
            ? "bg-accent/10 border-accent"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!hasMedia) playCrinkle();
          fileInputRef.current?.click();
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          onChange={handleChange}
        />

        {hasMedia ? (
          <div className="relative w-full h-full flex items-center justify-center p-3">
            {mediaType === "video" ? (
              <video
                src={currentMediaUrl!}
                className="max-h-full max-w-full object-contain rounded-sm opacity-80"
                muted
              />
            ) : (
              <img
                src={currentMediaUrl!}
                alt="Source media"
                className="max-h-full max-w-full object-contain rounded-sm opacity-80"
              />
            )}
            {/* Replace overlay */}
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="tape-btn tape-btn-small">
                <UploadCloud className="w-4 h-4" /> Replace
              </div>
            </div>

            {/* Clear button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playCrinkle();
                onClear();
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-sm bg-card border-2 border-charcoal flex items-center justify-center transition-colors text-muted hover:bg-accent hover:text-foreground z-10"
              aria-label="Remove media"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Type badge */}
            <div className="absolute bottom-2 left-2 tape-btn tape-btn-small pointer-events-none text-[9px]">
              {mediaType === "video" ? "VIDEO" : "IMAGE"}
            </div>
          </div>
        ) : (
          <div className="w-full h-full relative group">
            <SmpteLoader animate={isDragging} />
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/40 backdrop-blur-sm z-20">
              <div className="w-16 h-16 rounded-sm border-2 border-charcoal bg-card flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-300 mb-4 shadow-xl">
                 <UploadCloud className="w-8 h-8 text-charcoal" />
              </div>
              <div className="bg-card px-6 py-2 border-2 border-charcoal rounded-sm shadow-lg rotate-[1deg]">
                <p className="text-sm font-hand font-bold text-foreground">
                  Drop your media here
                </p>
                <p className="text-xs font-hand text-muted mt-1 text-center">
                  PNG, JPG, MP4, WebM
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
