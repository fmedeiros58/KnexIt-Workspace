import { useCallback, useState } from "react";
import type { VioReadDocument } from "../lib/vioreadTypes";
import { requestTranslation } from "../lib/vioreadApi";

type TranslateArgs = {
  document: VioReadDocument;
  sourceLang: string;
  targetLang: string;
};

export function useTranslationJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translate = useCallback(async ({ document, sourceLang, targetLang }: TranslateArgs): Promise<VioReadDocument> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestTranslation({ document, sourceLang, targetLang });
      return result;
    } catch (e: any) {
      setError(e?.message || "Falha ao traduzir");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { translate, loading, error };
}

