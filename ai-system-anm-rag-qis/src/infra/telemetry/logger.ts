import { telemetryConfig } from "./telemetry-config";

export function logInfo(message: string, metadata?: Record<string, unknown>) {
  if (!telemetryConfig.enabled) return;
  void metadata;
  void message;
}
