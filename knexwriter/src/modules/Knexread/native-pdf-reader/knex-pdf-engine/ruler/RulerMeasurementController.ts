export function computeRulerMeasurementOrigin(input: {
  sourcePageLeft: number;
}) {
  return {
    rulerZeroX: input.sourcePageLeft,
  };
}
