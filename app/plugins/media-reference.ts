import type { MediaAsset } from "../sdk/media.ts";

export function mediaReference(asset: MediaAsset) {
  return `Media saved: ${asset.name}, id=${asset.id}, type=${asset.mime}, bytes=${asset.bytes}.`;
}
