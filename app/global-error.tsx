'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: 16 }}>
          <h2>Falha inesperada</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {String(error?.message ?? error)}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: 12 }}>
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
