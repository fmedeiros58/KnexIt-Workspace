import { createId } from "../utils/ids/createId";
import { now } from "../utils/dates/now";
import type { DomainEvent, DomainEventHandler, DomainEventName } from "./domain-events.types";

type HandlerMap = {
  [key in DomainEventName]?: Set<DomainEventHandler>;
};

export class DomainEventBus {
  private readonly handlers: HandlerMap = {};

  subscribe(name: DomainEventName, handler: DomainEventHandler): () => void {
    if (!this.handlers[name]) this.handlers[name] = new Set();
    this.handlers[name]!.add(handler);
    return () => {
      this.handlers[name]?.delete(handler);
    };
  }

  async publish<TPayload extends Record<string, unknown>>(
    name: DomainEventName,
    payload: TPayload,
    context?: { projectId?: string; documentId?: string },
  ): Promise<DomainEvent<TPayload>> {
    const event: DomainEvent<TPayload> = {
      id: createId(),
      name,
      occurredAt: now(),
      projectId: context?.projectId,
      documentId: context?.documentId,
      payload,
    };

    const handlers = Array.from(this.handlers[name] ?? []);
    await Promise.all(handlers.map(async (handler) => handler(event)));
    return event;
  }
}

