export type RulerTick = {
  value: number;
  position: number;
  major: boolean;
  label: number;
};

export function calculateRulerTicks(input: {
  visibleStart: number;
  visibleEnd: number;
  tickStep: number;
  pxPerMajorUnit: number;
  majorTickModulo?: number;
}) {
  const majorTickModulo = input.majorTickModulo ?? 5;
  const start = Math.floor(input.visibleStart / input.tickStep) * input.tickStep;
  const ticks: RulerTick[] = [];
  for (let value = start; value <= input.visibleEnd + input.tickStep; value += input.tickStep) {
    const tickIndex = Math.round(value / input.tickStep);
    ticks.push({
      value,
      position: value,
      major: tickIndex % majorTickModulo === 0,
      label: Math.round(value / input.pxPerMajorUnit),
    });
  }
  return ticks;
}
