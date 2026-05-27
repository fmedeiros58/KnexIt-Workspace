import type {
  PdfTranslationRuntime,
  PdfTranslationStrategy,
  TranslationInput,
  TranslationOutput,
  TranslationProvider,
} from "../../types";
import { localTranslationProvider } from "./localTranslation.provider";
import { onlineTranslationProvider } from "./onlineTranslation.provider";

function resolveRuntime(): PdfTranslationRuntime {
  if (typeof window === "undefined") return "web";
  const hasStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const hasTauri = typeof (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== "undefined";
  if (hasTauri) return "desktop";
  if (hasStandalone) return "pwa";
  return "web";
}

function isOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

type RouterConfig = {
  runtime?: PdfTranslationRuntime;
  strategy?: PdfTranslationStrategy;
  preferredProviderId?: string;
};

function buildPreferenceOrder(input: {
  strategy: PdfTranslationStrategy;
  providers: TranslationProvider[];
  runtime: PdfTranslationRuntime;
  online: boolean;
  preferredProviderId?: string;
}) {
  const runtimeProviders = input.providers.filter((provider) =>
    provider.runtime.includes(input.runtime),
  );
  const localProviders = runtimeProviders.filter((provider) => provider.supportsOffline);
  const onlineProviders = runtimeProviders.filter((provider) => !provider.supportsOffline);

  const byPreference = (providers: TranslationProvider[]) => {
    if (!input.preferredProviderId) return providers;
    return [...providers].sort((a, b) => {
      if (a.id === input.preferredProviderId) return -1;
      if (b.id === input.preferredProviderId) return 1;
      return 0;
    });
  };

  switch (input.strategy) {
    case "local-only":
      return byPreference(localProviders);
    case "online-only":
      return input.online ? byPreference(onlineProviders) : [];
    case "online-first":
      return input.online
        ? byPreference([...onlineProviders, ...localProviders])
        : byPreference(localProviders);
    case "auto":
      return input.online
        ? byPreference([...localProviders, ...onlineProviders])
        : byPreference(localProviders);
    case "local-first":
    default:
      return input.online
        ? byPreference([...localProviders, ...onlineProviders])
        : byPreference(localProviders);
  }
}

class TranslationProviderRouter {
  private providers = new Map<string, TranslationProvider>();

  constructor() {
    [localTranslationProvider, onlineTranslationProvider].forEach((provider) => {
      this.providers.set(provider.id, provider);
    });
  }

  register(provider: TranslationProvider) {
    this.providers.set(provider.id, provider);
  }

  listProviders() {
    return Array.from(this.providers.values());
  }

  async translate(
    input: TranslationInput,
    config?: RouterConfig,
  ): Promise<TranslationOutput> {
    const strategy = config?.strategy ?? "local-first";
    const runtime = config?.runtime ?? resolveRuntime();
    const providers = this.listProviders();
    const ordered = buildPreferenceOrder({
      strategy,
      providers,
      runtime,
      online: isOnline(),
      preferredProviderId: config?.preferredProviderId,
    });

    if (!ordered.length) {
      throw new Error("Nenhum provider de traducao disponivel para o modo selecionado.");
    }

    let lastError: Error | null = null;
    for (const provider of ordered) {
      try {
        return await provider.translate(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Erro ao traduzir bloco");
      }
    }

    throw (
      lastError ??
      new Error("Todos os providers de traducao falharam para o bloco solicitado.")
    );
  }
}

export const translationProviderRouter = new TranslationProviderRouter();
