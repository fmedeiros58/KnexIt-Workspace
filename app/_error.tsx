// app/error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="p-6">
        <h2 className="text-xl font-semibold">Algo deu errado.</h2>
        <pre className="mt-3 p-3 bg-slate-100 rounded">{error.message}</pre>
        <button
          onClick={() => reset()}
          className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
