import type { KnexPdfDeviceCapabilities, KnexPdfRuntimePlatform } from "../core/engineTypes";

export interface PlatformAdapter {
  readonly platform: KnexPdfRuntimePlatform;
  getDeviceCapabilities(): KnexPdfDeviceCapabilities;
}
