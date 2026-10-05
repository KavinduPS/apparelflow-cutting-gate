import { z } from "zod";

export const createOrderSchema = z
  .object({
    recipeId: z
      .number({
        error: "Recipe ID must be a number",
      })
      .int("Recipe ID must be a whole number")
      .min(1, "Recipe ID must be at least 1"),

    targetQty: z
      .number({
        error: "Target quantity must be a number",
      })
      .int("Target quantity must be a whole number")
      .min(1, "Target quantity must be at least 1")
      .max(100000, "Target quantity must not exceed 100000"),

    fabricRollId: z
      .string({
        error: "Fabric roll ID must be a string",
      })
      .trim()
      .min(1, "Fabric roll ID is required")
      .max(50, "Fabric roll ID must not exceed 50 characters")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Fabric roll ID may contain only letters, numbers, hyphens, and underscores",
      ),

    actualFabricYds: z
      .number({
        error: "Actual fabric yards must be a number",
      })
      .positive("Actual fabric yards must be greater than 0")
      .max(999999.99, "Actual fabric yards is too large")
      .refine(
        (value) => Number.isInteger(value * 100),
        "Actual fabric yards must have at most 2 decimal places",
      ),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
