import { describe, expect, it } from "vitest";
import { expectedComponentCounts, expectedFabricYards } from "./expected";

describe("expectedComponentCounts", () => {
  it("calculates expected quantities for a blouse", () => {
    const components = [
      {
        id: 1,
        componentName: "Front Body Panel",
        piecesPerGarment: 1,
      },
      {
        id: 2,
        componentName: "Back Body Panel",
        piecesPerGarment: 1,
      },
      {
        id: 3,
        componentName: "Sleeves",
        piecesPerGarment: 2,
      },
      {
        id: 4,
        componentName: "Sleeve Cuffs",
        piecesPerGarment: 2,
      },
    ];

    const result = expectedComponentCounts(50, components);

    expect(result).toEqual([
      {
        id: 1,
        componentName: "Front Body Panel",
        piecesPerGarment: 1,
        expectedQty: 50,
      },
      {
        id: 2,
        componentName: "Back Body Panel",
        piecesPerGarment: 1,
        expectedQty: 50,
      },
      {
        id: 3,
        componentName: "Sleeves",
        piecesPerGarment: 2,
        expectedQty: 100,
      },
      {
        id: 4,
        componentName: "Sleeve Cuffs",
        piecesPerGarment: 2,
        expectedQty: 100,
      },
    ]);
  });

  it("calculates expected quantities for a crop top", () => {
    const components = [
      {
        id: 1,
        componentName: "Front Chest Panel",
        piecesPerGarment: 1,
      },
      {
        id: 2,
        componentName: "Side Strap Accents",
        piecesPerGarment: 2,
      },
    ];

    const result = expectedComponentCounts(25, components);

    expect(result[0].expectedQty).toBe(25);
    expect(result[1].expectedQty).toBe(50);
  });

  it("works with a target quantity of 1", () => {
    const components = [
      {
        id: 1,
        componentName: "Sleeve Cuffs",
        piecesPerGarment: 2,
      },
    ];

    expect(expectedComponentCounts(1, components)[0].expectedQty).toBe(2);
  });
});

describe("expectedFabricYards", () => {
  it("calculates expected fabric", () => {
    expect(expectedFabricYards(1.8, 50)).toBe(90);
  });

  it("rounds floating point results to two decimal places", () => {
    expect(expectedFabricYards(1.1, 3)).toBe(3.3);
  });
});
