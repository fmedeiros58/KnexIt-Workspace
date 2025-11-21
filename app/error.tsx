'use client';
import { useEffect } from 'react';

export default function Error({
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
    <div className="p-6">
      <h2 className="text-xl font-semibold">Algo deu errado.</h2>
      {error?.message && (
        <p className="mt-2 text-sm text-slate-600">
          {String(error.message)}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md border px-3 py-2"
      >
        Tentar novamente
      </button>
    </div>
  );
}
