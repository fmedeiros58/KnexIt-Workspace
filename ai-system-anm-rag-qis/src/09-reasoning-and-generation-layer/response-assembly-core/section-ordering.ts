export function orderSections(sections: Array<{ title: string; content: string }>): Array<{ title: string; content: string }> {
  const rank = new Map<string, number>([
    ["Resposta", 1],
    ["Base inferencial", 2],
    ["Caveats", 3],
    ["Conclusao", 4],
  ]);
  return [...sections].sort((a, b) => (rank.get(a.title) || 99) - (rank.get(b.title) || 99));
}
