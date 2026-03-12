export function createChunkedTextStream(text: string, chunkSize = 96) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  const safeSize = Math.max(24, chunkSize);
  for (let cursor = 0; cursor < text.length; cursor += safeSize) {
    chunks.push(text.slice(cursor, Math.min(text.length, cursor + safeSize)));
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

export function tapPlainTextResponse(upstream: Response, onComplete: (text: string) => Promise<void> | void) {
  if (!upstream.body) return upstream;

  const [clientStream, auditStream] = upstream.body.tee();
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  headers.set("content-type", upstream.headers.get("content-type") || "text/plain; charset=utf-8");
  const requestId = upstream.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);

  void (async () => {
    const reader = auditStream.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) fullText += decoder.decode(value, { stream: true });
      }
      fullText += decoder.decode();
      await onComplete(fullText);
    } catch {
      // melhor-esforco: nao interromper a resposta do cliente
    } finally {
      reader.releaseLock();
    }
  })();

  return new Response(clientStream, { status: upstream.status, headers });
}

