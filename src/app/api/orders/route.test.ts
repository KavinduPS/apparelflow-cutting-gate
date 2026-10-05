import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/db/client";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    recipe: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
    });

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when the user is not a cutting supervisor", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
    });

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 422 when the request body is invalid", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 1,
        email: "supervisor@test.com",
        fullName: "Cutting Supervisor",
        role: "cutting_supervisor",
      },
    });

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        recipeId: "1",
        targetQty: "50",
        fabricRollId: "",
        actualFabricYds: "90",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data.error).toBe("Validation failed");
    expect(data.fields).toBeDefined();

    expect(prisma.recipe.findUnique).not.toHaveBeenCalled();
  });

  it("returns 422 when the recipe does not exist", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 1,
        email: "supervisor@test.com",
        fullName: "Cutting Supervisor",
        role: "cutting_supervisor",
      },
    });

    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(null);

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        recipeId: 999,
        targetQty: 50,
        fabricRollId: "ROLL-001",
        actualFabricYds: 90,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data).toEqual({
      error: "Recipe not found",
      fields: {
        recipeId: ["Recipe does not exist"],
      },
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a valid cutting order with server-controlled values", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 1,
        email: "supervisor@test.com",
        fullName: "Cutting Supervisor",
        role: "cutting_supervisor",
      },
    });

    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      id: 1,
      recipeCode: "REC-BL01",
      name: "Casual Blouse",
      category: "Blouse",
      stdFabricYards: 1.8,
      wastageCap: 5,
      components: [
        {
          id: 1,
          componentName: "Front Panel",
          piecesPerGarment: 1,
        },
        {
          id: 2,
          componentName: "Back Panel",
          piecesPerGarment: 1,
        },
      ],
    } as never);

    const createdOrder = {
      id: 15,
      orderNo: "CUT-0015",
      status: "CUTTING_IN_PROGRESS",
      recipeId: 1,
      targetQty: 50,
      fabricRollId: "ROLL-001",
      actualFabricYds: 90,
      createdBy: 1,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        cuttingOrder: {
          create: vi.fn().mockResolvedValue({
            id: 15,
          }),
          update: vi.fn().mockResolvedValue(createdOrder),
        },
      };

      return callback(tx as never);
    });

    const request = new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        recipeId: 1,
        targetQty: 50,
        fabricRollId: "ROLL-001",
        actualFabricYds: 90,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(201);

    const data = await response.json();

    expect(data).toEqual({
      id: 15,
      orderNo: "CUT-0015",
      status: "CUTTING_IN_PROGRESS",
      recipeId: 1,
      targetQty: 50,
      fabricRollId: "ROLL-001",
      actualFabricYds: 90,
      expectedFabricYds: 90,
      expectedComponents: [
        {
          id: 1,
          componentName: "Front Panel",
          piecesPerGarment: 1,
          expectedQty: 50,
        },
        {
          id: 2,
          componentName: "Back Panel",
          piecesPerGarment: 1,
          expectedQty: 50,
        },
      ],
    });
  });
});
