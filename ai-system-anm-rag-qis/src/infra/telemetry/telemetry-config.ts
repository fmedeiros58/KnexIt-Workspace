export interface TelemetryConfig {
  serviceName: string;
  enabled: boolean;
}

export const telemetryConfig: TelemetryConfig = {
  serviceName: "anm-rag-qis",
  enabled: true,
};
