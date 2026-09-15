import type { MediaAsset } from "./media.ts";

export interface BrowserAnnotationBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parent-window client coordinates in CSS pixels/DIPs at the shell's zoom. */
export interface BrowserViewport extends BrowserAnnotationBounds {
  visible: boolean;
}

export interface BrowserAnnotation {
  id: string;
  url: string;
  x: number;
  y: number;
  bounds?: BrowserAnnotationBounds;
  /** Page scroll in CSS pixels at capture; absent on older annotations. */
  scroll?: { x: number; y: number };
  viewport?: { width: number; height: number };
  comment: string;
  element?: unknown;
  screenshot?: MediaAsset;
}

export interface BrowserPairingState {
  viewId?: string;
  sessionId?: string;
  ready: boolean;
  url: string;
}
