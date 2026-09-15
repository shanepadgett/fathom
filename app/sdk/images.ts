import type { MutableImagesModels } from "@earendil-works/pi-ai";
import type { MediaAsset } from "./media.ts";

export interface ImageSelection {
  provider: string;
  model: string;
}
export interface ImageGenerationService {
  models: MutableImagesModels;
  generate(
    sessionId: string,
    input: { prompt: string; images?: string[]; destination?: string },
    signal?: AbortSignal,
  ): Promise<{ assets: MediaAsset[]; text: string; path?: string }>;
}
