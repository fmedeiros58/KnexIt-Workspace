import { WebPlatformAdapter } from "./WebPlatformAdapter";

export class DesktopPlatformAdapter extends WebPlatformAdapter {
  readonly platform = "desktop" as const;
}
