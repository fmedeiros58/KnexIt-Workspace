import { WebPlatformAdapter } from "./WebPlatformAdapter";

export class MobilePlatformAdapter extends WebPlatformAdapter {
  readonly platform = "mobile" as const;
}
