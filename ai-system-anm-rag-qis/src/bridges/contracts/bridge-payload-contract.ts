export interface BridgePayloadContract<TPayload extends object> {
  bridge: string;
  version: string;
  payload: TPayload;
  metadata?: Record<string, string | number | boolean>;
}

export function makeBridgePayload<TPayload extends object>(input: BridgePayloadContract<TPayload>) {
  return input;
}
