import type { KnexPdfDeviceCapabilities, KnexPdfRuntimePlatform } from "../core/engineTypes";

function detectPlatform(): KnexPdfRuntimePlatform {
  if (typeof window === "undefined") return "web";
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouch =
    "ontouchstart" in window ||
    window.navigator.maxTouchPoints > 0;
  if (/electron/.test(userAgent)) return "desktop";
  if (isTouch && Math.min(window.innerWidth, window.innerHeight) < 768) return "mobile";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  return "web";
}

function classifyPerformance(input: {
  devicePixelRatio: number;
  approximateMemoryGb?: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const pixels = input.screenWidth * input.screenHeight * input.devicePixelRatio;
  if ((input.approximateMemoryGb ?? 4) >= 8 && pixels >= 3_000_000) return "high";
  if ((input.approximateMemoryGb ?? 4) >= 4 && pixels >= 1_000_000) return "medium";
  return "low";
}

export function detectKnexPdfDeviceCapabilities(): KnexPdfDeviceCapabilities {
  if (typeof window === "undefined") {
    return {
      platform: "web",
      devicePixelRatio: 1,
      supportsOffscreenCanvas: false,
      supportsWorker: false,
      supportsWasm: typeof WebAssembly !== "undefined",
      isTouch: false,
      screenWidth: 0,
      screenHeight: 0,
      performanceClass: "medium",
    };
  }

  const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const approximateMemoryGb =
    typeof window.navigator === "object" &&
    "deviceMemory" in window.navigator
      ? Number((window.navigator as Navigator & { deviceMemory?: number }).deviceMemory)
      : undefined;
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  const isTouch =
    "ontouchstart" in window ||
    window.navigator.maxTouchPoints > 0;

  return {
    platform: detectPlatform(),
    devicePixelRatio,
    approximateMemoryGb,
    supportsOffscreenCanvas: typeof OffscreenCanvas !== "undefined",
    supportsWorker: typeof Worker !== "undefined",
    supportsWasm: typeof WebAssembly !== "undefined",
    isTouch,
    screenWidth,
    screenHeight,
    performanceClass: classifyPerformance({
      devicePixelRatio,
      approximateMemoryGb,
      screenWidth,
      screenHeight,
    }),
  };
}
