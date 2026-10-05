export type ExpectedComponent = {
  id: number;
  componentName: string;
  piecesPerGarment: number;
};

export type ExpectedComponentCount = ExpectedComponent & {
  expectedQty: number;
};

export function expectedComponentCounts(
  targetQty: number,
  components: ExpectedComponent[],
): ExpectedComponentCount[] {
  return components.map((component) => ({
    ...component,
    expectedQty: targetQty * component.piecesPerGarment,
  }));
}

export function expectedFabricYards(
  stdFabricYards: number,
  targetQty: number,
): number {
  return Number((stdFabricYards * targetQty).toFixed(2));
}
