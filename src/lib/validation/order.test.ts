import { describe, expect, it } from "vitest";
import { createOrderSchema } from "./order";

describe("createOrderSchema", () => {
  const validOrder = {
    recipeId: 1,
    targetQty: 50,
    fabricRollId: "ROLL-001",
    actualFabricYds: 91.25,
  };

  it("accepts a valid order", () => {
    const result = createOrderSchema.safeParse(validOrder);

    expect(result.success).toBe(true);
  });

  it("rejects a string target quantity", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      targetQty: "50",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a decimal target quantity", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      targetQty: 50.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero target quantity", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      targetQty: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects target quantity above 100000", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      targetQty: 100001,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty fabric roll ID", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      fabricRollId: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid fabric roll ID", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      fabricRollId: "ROLL 001",
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative fabric usage", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      actualFabricYds: -10,
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than two decimal places", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      actualFabricYds: 91.256,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      status: "VERIFIED",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing recipeId", () => {
    const { recipeId, ...withoutRecipe } = validOrder;

    const result = createOrderSchema.safeParse(withoutRecipe);

    expect(result.success).toBe(false);
  });

  it("rejects null values", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      targetQty: null,
    });

    expect(result.success).toBe(false);
  });
});
