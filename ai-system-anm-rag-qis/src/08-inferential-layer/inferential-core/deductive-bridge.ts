export function buildDeductiveBridge(implications: string[], consequences: string[]): string[] {
  const bridges: string[] = [];
  for (const implication of implications.slice(0, 3)) {
    for (const consequence of consequences.slice(0, 2)) {
      bridges.push(`${implication} Portanto, ${consequence.charAt(0).toLowerCase()}${consequence.slice(1)}`);
    }
  }
  return bridges.slice(0, 4);
}
