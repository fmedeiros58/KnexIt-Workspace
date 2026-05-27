import type { PlatformAdapter } from "./PlatformAdapter";
import { detectKnexPdfDeviceCapabilities } from "./DeviceCapabilities";
import type { KnexPdfRuntimePlatform } from "../core/engineTypes";

export class WebPlatformAdapter implements PlatformAdapter {
  readonly platform: KnexPdfRuntimePlatform = "web";

  getDeviceCapabilities() {
    return detectKnexPdfDeviceCapabilities();
  }
}
