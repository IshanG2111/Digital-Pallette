export type RGB = [number, number, number];

export interface Palette {
  id: string;
  name: string;
  colors: RGB[];
  isFavorite?: boolean;
}

export interface ControlState {
  intensity: number;      // 0 to 100
  exposure: number;       // -100 to 100
  contrast: number;       // -100 to 100
  highlights: number;     // -100 to 100
  shadows: number;        // -100 to 100
  temperature: number;    // -100 to 100
  tint: number;           // -100 to 100
  saturation: number;     // -100 to 100
  vibrance: number;       // -100 to 100
  skinToneProtection: boolean;
}

export const DEFAULT_CONTROLS: ControlState = {
  intensity: 50,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  skinToneProtection: false,
};

export interface Snapshot {
  id: string;
  name: string;
  palette: Palette;
  controls: ControlState;
  timestamp: number;
}

export type MediaType = "image" | "video" | null;

export interface EngineStatus {
  state: "idle" | "ready" | "processing" | "done" | "error";
  message: string;
  progress?: number; // 0-100 for processing
}
