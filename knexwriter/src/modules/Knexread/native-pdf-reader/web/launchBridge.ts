type KnexreadLaunchPayload = {
  file: File;
  projectId: string;
  documentId?: string;
  sourceId?: string;
  sourceName?: string;
};

const launchStore = new Map<string, KnexreadLaunchPayload>();

function createLaunchId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `knexread-launch-${crypto.randomUUID()}`;
  }
  return `knexread-launch-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function createKnexreadLaunch(payload: KnexreadLaunchPayload) {
  const launchId = createLaunchId();
  launchStore.set(launchId, payload);
  return launchId;
}

export function consumeKnexreadLaunch(launchId: string) {
  const payload = launchStore.get(launchId) ?? null;
  if (payload) {
    launchStore.delete(launchId);
  }
  return payload;
}

