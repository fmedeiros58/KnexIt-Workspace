const KNX_STREAM_EVENT_START = "[[KNX_EVT]]";
const KNX_STREAM_EVENT_END = "[[/KNX_EVT]]";
const CONTROL_MARKER_SAFE_TAIL = Math.max(0, KNX_STREAM_EVENT_START.length - 1);

function createSseFrame(event: "delta" | "done" | "error" | "progress", data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function toSseStream(plainTextStream: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const reader = plainTextStream.getReader();
      let buffer = "";
      const emitDelta = (text: string) => {
        if (!text) return;
        controller.enqueue(encoder.encode(createSseFrame("delta", { text })));
      };
      const emitProgress = (payloadText: string) => {
        if (!payloadText.trim()) return;
        try {
          const payload = JSON.parse(payloadText) as Record<string, unknown>;
          const eventName = `${payload?.event || ""}`.trim().toLowerCase();
          if (eventName === "progress") {
            controller.enqueue(encoder.encode(createSseFrame("progress", payload)));
            return;
          }
        } catch {
          // ignore malformed control payloads
        }
      };
      const flushBuffer = (force: boolean) => {
        while (true) {
          const startIdx = buffer.indexOf(KNX_STREAM_EVENT_START);
          if (startIdx < 0) {
            if (force && buffer) {
              emitDelta(buffer);
              buffer = "";
            } else if (!force && buffer.length > 0) {
              // Faz flush incremental e mantem apenas uma pequena cauda para nao vazar marcador fragmentado.
              const keepTail = Math.min(CONTROL_MARKER_SAFE_TAIL, buffer.length);
              const flushLen = Math.max(0, buffer.length - keepTail);
              if (flushLen > 0) {
                emitDelta(buffer.slice(0, flushLen));
                buffer = buffer.slice(flushLen);
              }
            }
            return;
          }

          if (startIdx > 0) {
            emitDelta(buffer.slice(0, startIdx));
            buffer = buffer.slice(startIdx);
          }

          const payloadStart = KNX_STREAM_EVENT_START.length;
          const endIdx = buffer.indexOf(KNX_STREAM_EVENT_END, payloadStart);
          if (endIdx < 0) {
            if (force) {
              // Se sobrou marcador incompleto no fim do stream, descarta para nao poluir resposta.
              buffer = "";
            }
            return;
          }

          const payloadText = buffer.slice(payloadStart, endIdx);
          emitProgress(payloadText);
          buffer = buffer.slice(endIdx + KNX_STREAM_EVENT_END.length);
        }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = decoder.decode(value, { stream: true });
          if (!delta) continue;
          buffer += delta;
          flushBuffer(false);
        }
        const tail = decoder.decode();
        if (tail) {
          buffer += tail;
        }
        flushBuffer(true);
        controller.enqueue(encoder.encode(createSseFrame("done", { finishReason: "stop" })));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "stream_error";
        controller.enqueue(encoder.encode(createSseFrame("error", { message })));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel: async () => {
      // Stop upstream reader when client disconnects.
      await plainTextStream.cancel().catch(() => undefined);
    },
  });
}
