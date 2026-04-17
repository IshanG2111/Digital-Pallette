export type RGB = [number, number, number];

export interface Palette {
  id: string;
  name: string;
  colors: RGB[];
  isFavorite?: boolean;
}

export interface ControlState {
  intensity: number;   // 0 to 100
  contrast: number;    // -100 to 100
  saturation: number;  // -100 to 100
  temperature: number; // -100 to 100
}

export const DEFAULT_CONTROLS: ControlState = {
  intensity: 50,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

export type MediaType = "image" | "video" | null;

export interface EngineStatus {
  state: "idle" | "ready" | "processing" | "done" | "error";
  message: string;
  progress?: number; // 0-100 for processing
}
