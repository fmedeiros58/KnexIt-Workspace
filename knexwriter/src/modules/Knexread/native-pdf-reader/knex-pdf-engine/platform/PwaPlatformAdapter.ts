import { WebPlatformAdapter } from "./WebPlatformAdapter";

export class PwaPlatformAdapter extends WebPlatformAdapter {
  readonly platform = "pwa" as const;
}
