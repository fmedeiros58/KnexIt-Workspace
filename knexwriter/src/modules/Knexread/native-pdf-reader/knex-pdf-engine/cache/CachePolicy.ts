export type CachePolicy = {
  maxBitmapPages: number;
  maxTileCount: number;
  maxTextMaps: number;
};

export function createDefaultCachePolicy(performanceClass: "low" | "medium" | "high"): CachePolicy {
  if (performanceClass === "high") {
    return { maxBitmapPages: 12, maxTileCount: 256, maxTextMaps: 80 };
  }
  if (performanceClass === "medium") {
    return { maxBitmapPages: 6, maxTileCount: 128, maxTextMaps: 40 };
  }
  return { maxBitmapPages: 3, maxTileCount: 64, maxTextMaps: 20 };
}
