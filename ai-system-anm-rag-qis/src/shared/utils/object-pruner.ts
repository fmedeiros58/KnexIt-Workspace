export function pruneObject<T extends Record<string, unknown>>(value: T, keysToDrop: string[]): T {
  const clone: Record<string, unknown> = { ...value };
  for (const key of keysToDrop) {
    delete clone[key];
  }
  return clone as T;
}
