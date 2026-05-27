import type { KnexPdfRenderPhase } from "./RenderQualityController";

export type RenderQueueItem = {
  pageNumber: number;
  priority: number;
  renderVersion: number;
  backendId?: string;
  phase?: KnexPdfRenderPhase;
};

type InternalRenderQueueItem = RenderQueueItem & {
  sequence: number;
};

const RENDER_PHASE_RANK: Record<KnexPdfRenderPhase, number> = {
  "interactive-preview": 1,
  "warmup-preview": 2,
  "settled-final": 3,
};

function getPhaseRank(phase?: KnexPdfRenderPhase): number {
  return phase ? RENDER_PHASE_RANK[phase] ?? 0 : 0;
}

function getSafePriority(priority: number): number {
  return Number.isFinite(priority) ? priority : 0;
}

function isSameQueueSlot(
  candidate: RenderQueueItem,
  item: RenderQueueItem,
): boolean {
  /**
   * Uma página não deve ter múltiplos renders concorrentes na mesma versão.
   * A fase/prioridade/backend decidem qual pedido vence.
   */
  return (
    candidate.pageNumber === item.pageNumber &&
    candidate.renderVersion === item.renderVersion
  );
}

function shouldReplaceExistingQueueItem(input: {
  existing: RenderQueueItem;
  incoming: RenderQueueItem;
}): boolean {
  const existingPriority = getSafePriority(input.existing.priority);
  const incomingPriority = getSafePriority(input.incoming.priority);

  if (incomingPriority > existingPriority) return true;
  if (incomingPriority < existingPriority) return false;

  const existingPhaseRank = getPhaseRank(input.existing.phase);
  const incomingPhaseRank = getPhaseRank(input.incoming.phase);

  if (incomingPhaseRank > existingPhaseRank) return true;
  if (incomingPhaseRank < existingPhaseRank) return false;

  /**
   * Se prioridade e fase forem iguais, aceitamos atualizar o item.
   * Isso permite atualizar backendId ou metadados sem rebaixar a fila.
   */
  return true;
}

function compareQueueItems(
  a: InternalRenderQueueItem,
  b: InternalRenderQueueItem,
): number {
  const priorityDelta = getSafePriority(b.priority) - getSafePriority(a.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const phaseDelta = getPhaseRank(b.phase) - getPhaseRank(a.phase);
  if (phaseDelta !== 0) return phaseDelta;

  /**
   * Em empate, páginas menores primeiro mantém navegação previsível.
   */
  const pageDelta = a.pageNumber - b.pageNumber;
  if (pageDelta !== 0) return pageDelta;

  /**
   * Por fim, preserva ordem de entrada.
   */
  return a.sequence - b.sequence;
}

export class RenderQueue {
  private items: InternalRenderQueueItem[] = [];
  private sequence = 0;

  enqueue(item: RenderQueueItem) {
    const normalizedItem: InternalRenderQueueItem = {
      ...item,
      priority: getSafePriority(item.priority),
      sequence: this.sequence,
    };

    const existingIndex = this.items.findIndex((candidate) =>
      isSameQueueSlot(candidate, normalizedItem),
    );

    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];

      if (
        !shouldReplaceExistingQueueItem({
          existing,
          incoming: normalizedItem,
        })
      ) {
        return;
      }

      /**
       * Mantém a sequência original para evitar tremulação de ordenação quando
       * o item é apenas atualizado.
       */
      this.items[existingIndex] = {
        ...normalizedItem,
        sequence: existing.sequence,
      };
    } else {
      this.items.push({
        ...normalizedItem,
        sequence: this.sequence,
      });
      this.sequence += 1;
    }

    this.items.sort(compareQueueItems);
  }

  dequeue() {
    return this.items.shift();
  }

  clearOlderThan(renderVersion: number) {
    this.items = this.items.filter((item) => item.renderVersion >= renderVersion);
  }

  clear() {
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  snapshot(): RenderQueueItem[] {
    return this.items.map(({ sequence: _sequence, ...item }) => item);
  }
}