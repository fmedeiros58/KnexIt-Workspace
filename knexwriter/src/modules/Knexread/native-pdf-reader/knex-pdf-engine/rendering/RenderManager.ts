import { RenderQueue } from "./RenderQueue";

export type RenderScheduleReason =
  | "initial"
  | "scroll"
  | "zoom"
  | "wheel-zoom"
  | "pinch-zoom"
  | "zoom-settled"
  | "page-change"
  | "resize"
  | "quality-change"
  | "manual";

export type RenderManagerOptions = {
  /**
   * Quantas páginas, no máximo, entram na fila durante gesto de zoom.
   * A ideia é impedir renderização em massa enquanto o usuário ainda está
   * girando o scroll ou fazendo pinch.
   */
  maxPagesDuringZoom: number;

  /**
   * Quantas páginas vizinhas entram na fila depois que o zoom estabiliza.
   */
  settledNeighborRadius: number;

  /**
   * Quantas páginas vizinhas entram na fila em scroll normal.
   */
  scrollNeighborRadius: number;
};

export type ScheduleVisiblePagesInput = {
  /**
   * Página ativa, geralmente a página mais visível ou a página atual do toolbar.
   */
  activePageNumber?: number;

  /**
   * Páginas atualmente visíveis ou parcialmente visíveis.
   */
  pageNumbers: number[];

  /**
   * Total de páginas do documento. Usado apenas para limitar vizinhos.
   */
  pageCount?: number;

  /**
   * Motivo do agendamento.
   */
  reason?: RenderScheduleReason;

  /**
   * Quando true, agenda somente o mínimo necessário.
   */
  isZooming?: boolean;

  /**
   * Se true, força nova versão de render antes de agendar.
   */
  bumpVersion?: boolean;
};

export type ScheduledRenderPlan = {
  renderVersion: number;
  reason: RenderScheduleReason;
  pages: number[];
  isZooming: boolean;
};

const DEFAULT_OPTIONS: RenderManagerOptions = {
  maxPagesDuringZoom: 2,
  settledNeighborRadius: 1,
  scrollNeighborRadius: 1,
};

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizePageNumber(pageNumber: number): number {
  return Math.max(1, Math.floor(safeNumber(pageNumber, 1)));
}

function uniquePageNumbers(pageNumbers: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];

  for (const item of pageNumbers) {
    const pageNumber = normalizePageNumber(item);

    if (seen.has(pageNumber)) continue;

    seen.add(pageNumber);
    result.push(pageNumber);
  }

  return result;
}

function clampPageNumber(pageNumber: number, pageCount?: number): number {
  const normalized = normalizePageNumber(pageNumber);

  if (!pageCount || pageCount < 1) return normalized;

  return Math.max(1, Math.min(pageCount, normalized));
}

function addNeighborPages(input: {
  pages: number[];
  activePageNumber?: number;
  pageCount?: number;
  radius: number;
}): number[] {
  const next = new Set<number>(input.pages.map(normalizePageNumber));

  if (!input.activePageNumber || input.radius <= 0) {
    return uniquePageNumbers([...next]);
  }

  const active = clampPageNumber(input.activePageNumber, input.pageCount);

  for (let offset = -input.radius; offset <= input.radius; offset += 1) {
    const candidate = active + offset;

    if (candidate < 1) continue;
    if (input.pageCount && candidate > input.pageCount) continue;

    next.add(candidate);
  }

  return uniquePageNumbers([...next]);
}

function sortPagesByPriority(input: {
  pages: number[];
  activePageNumber?: number;
}): number[] {
  const active = input.activePageNumber
    ? normalizePageNumber(input.activePageNumber)
    : undefined;

  return uniquePageNumbers(input.pages).sort((a, b) => {
    if (active) {
      if (a === active) return -1;
      if (b === active) return 1;

      const distanceA = Math.abs(a - active);
      const distanceB = Math.abs(b - active);

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
    }

    return a - b;
  });
}

function createScheduleKey(input: {
  renderVersion: number;
  reason: RenderScheduleReason;
  pages: number[];
  isZooming: boolean;
}) {
  return [
    input.renderVersion,
    input.reason,
    input.isZooming ? "zooming" : "settled",
    input.pages.join(","),
  ].join(":");
}

/**
 * RenderManager
 * ------------------------------------------------------------
 * Gerencia versões de renderização e agenda páginas na RenderQueue.
 *
 * Responsabilidade:
 * - impedir renderizações antigas de sobreviverem;
 * - priorizar página ativa;
 * - durante zoom, não enfileirar o documento inteiro;
 * - depois que o zoom estabiliza, permitir renderização progressiva;
 * - manter compatibilidade com a API antiga scheduleVisiblePages(pageNumbers).
 *
 * Observação:
 * Este manager NÃO renderiza canvas diretamente.
 * Ele apenas controla versão e fila.
 */
export class RenderManager {
  private renderVersion = 0;
  private options: RenderManagerOptions;
  private zoomGestureActive = false;
  private lastScheduleKey = "";

  readonly queue = new RenderQueue();

  constructor(options: Partial<RenderManagerOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  configure(options: Partial<RenderManagerOptions>) {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  /**
   * Cria uma nova versão global de render.
   * Tudo que for de versão anterior pode ser descartado.
   */
  nextRenderVersion() {
    this.renderVersion += 1;
    this.queue.clearOlderThan(this.renderVersion);
    this.lastScheduleKey = "";

    return this.renderVersion;
  }

  getCurrentRenderVersion() {
    return this.renderVersion;
  }

  isZooming() {
    return this.zoomGestureActive;
  }

  /**
   * Chamar no início do gesto de zoom.
   *
   * Isso cria nova versão para cancelar renders antigos e impedir que render
   * anterior sobrescreva o canvas novo.
   */
  beginZoomGesture() {
    this.zoomGestureActive = true;
    return this.nextRenderVersion();
  }

  /**
   * Chamar quando o gesto de zoom estabilizar.
   *
   * Cria nova versão para a renderização final em alta qualidade.
   */
  endZoomGesture() {
    this.zoomGestureActive = false;
    return this.nextRenderVersion();
  }

  /**
   * Mantém compatibilidade com a API antiga.
   *
   * Antes:
   * scheduleVisiblePages(pageNumbers)
   *
   * Agora:
   * agenda páginas visíveis com prioridade, sem quebrar chamadas existentes.
   */
  scheduleVisiblePages(pageNumbers: number[]) {
    return this.schedulePages({
      pageNumbers,
      reason: this.zoomGestureActive ? "zoom" : "scroll",
      isZooming: this.zoomGestureActive,
    });
  }

  /**
   * Método principal para agendamento inteligente.
   */
  schedulePages(input: ScheduleVisiblePagesInput): ScheduledRenderPlan {
    const reason = input.reason ?? "manual";
    const isZooming = input.isZooming ?? this.zoomGestureActive;

    if (input.bumpVersion) {
      this.nextRenderVersion();
    }

    let pages = uniquePageNumbers(input.pageNumbers);

    if (input.activePageNumber) {
      pages.unshift(clampPageNumber(input.activePageNumber, input.pageCount));
      pages = uniquePageNumbers(pages);
    }

    if (isZooming) {
      /**
       * Durante zoom, renderizar o mínimo:
       * - página ativa;
       * - eventualmente uma segunda página visível.
       */
      pages = sortPagesByPriority({
        pages,
        activePageNumber: input.activePageNumber,
      }).slice(0, Math.max(1, this.options.maxPagesDuringZoom));
    } else {
      /**
       * Fora do zoom, renderiza visíveis + vizinhas de forma progressiva.
       */
      const radius =
        reason === "zoom-settled"
          ? this.options.settledNeighborRadius
          : this.options.scrollNeighborRadius;

      pages = addNeighborPages({
        pages,
        activePageNumber: input.activePageNumber,
        pageCount: input.pageCount,
        radius,
      });

      pages = sortPagesByPriority({
        pages,
        activePageNumber: input.activePageNumber,
      });
    }

    const plan: ScheduledRenderPlan = {
      renderVersion: this.renderVersion,
      reason,
      pages,
      isZooming,
    };

    const scheduleKey = createScheduleKey(plan);

    /**
     * Evita enfileirar o mesmo conjunto repetidamente em sequência.
     */
    if (scheduleKey === this.lastScheduleKey) {
      return plan;
    }

    this.lastScheduleKey = scheduleKey;

    pages.forEach((pageNumber, index) => {
      /**
       * Prioridade maior para páginas mais importantes.
       * A primeira página do array é a mais importante.
       */
      this.queue.enqueue({
        pageNumber,
        priority: pages.length - index,
        renderVersion: this.renderVersion,
      });
    });

    return plan;
  }

  /**
   * Agenda a página ativa com máxima prioridade.
   */
  scheduleActivePage(input: {
    pageNumber: number;
    pageCount?: number;
    reason?: RenderScheduleReason;
    isZooming?: boolean;
    bumpVersion?: boolean;
  }) {
    const pageNumber = clampPageNumber(input.pageNumber, input.pageCount);

    return this.schedulePages({
      activePageNumber: pageNumber,
      pageNumbers: [pageNumber],
      pageCount: input.pageCount,
      reason: input.reason ?? "page-change",
      isZooming: input.isZooming,
      bumpVersion: input.bumpVersion,
    });
  }

  /**
   * Agenda render final após zoom estabilizar.
   */
  scheduleAfterZoomSettled(input: {
    activePageNumber: number;
    visiblePageNumbers: number[];
    pageCount?: number;
  }) {
    this.zoomGestureActive = false;

    return this.schedulePages({
      activePageNumber: input.activePageNumber,
      pageNumbers: input.visiblePageNumbers,
      pageCount: input.pageCount,
      reason: "zoom-settled",
      isZooming: false,
      bumpVersion: true,
    });
  }

  /**
   * Agenda render leve durante zoom.
   */
  scheduleDuringZoom(input: {
    activePageNumber: number;
    visiblePageNumbers: number[];
    pageCount?: number;
  }) {
    if (!this.zoomGestureActive) {
      this.zoomGestureActive = true;
      this.nextRenderVersion();
    }

    return this.schedulePages({
      activePageNumber: input.activePageNumber,
      pageNumbers: input.visiblePageNumbers,
      pageCount: input.pageCount,
      reason: "wheel-zoom",
      isZooming: true,
      bumpVersion: false,
    });
  }
}
