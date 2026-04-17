"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Film, ImageIcon, X } from "lucide-react";

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onUpload(e.target.files[0]);
  };

  const hasMedia = !!currentMediaUrl;

  return (
    <section className="flex flex-col gap-3 h-full" id="media-uploader">
      <h2 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
        <Film className="w-4 h-4" /> Media Source
      </h2>

      <div
        className={`glass-panel glass-panel-hover rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 flex-grow relative overflow-hidden group ${
          isDragging
            ? "border-primary/60 bg-primary/8 ring-2 ring-primary/20"
            : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
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
                className="max-h-full max-w-full object-contain rounded-lg opacity-50"
                muted
              />
            ) : (
              <img
                src={currentMediaUrl!}
                alt="Source media"
                className="max-h-full max-w-full object-contain rounded-lg opacity-50"
              />
            )}
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-medium border border-white/10 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-primary" />{" "}
                Replace Media
              </div>
            </div>

            {/* Clear button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-md bg-white/10 hover:bg-red-500/40 flex items-center justify-center transition-colors text-white/60 hover:text-white z-10"
              aria-label="Remove media"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Type badge */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-black/60 text-white/60 border border-white/5">
              {mediaType === "video" ? "VIDEO" : "IMAGE"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">
                Drop your media here
              </p>
              <p className="text-xs text-white/40 mt-1">
                PNG, JPG, MP4, WebM
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
