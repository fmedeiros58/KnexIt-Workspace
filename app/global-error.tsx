'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Sem hooks → evita runtime edge cases
  return (
    <html>
      <body>
        <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Falha inesperada</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {String(error?.message ?? error)}
          </pre>
          <button
            onClick={() => reset()}
            style={{ marginTop: 12, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6 }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
