import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/db/client";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    cuttingOrder: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/orders/sewing-queue", () => {
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

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.cuttingOrder.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not a sewing supervisor", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(prisma.cuttingOrder.findMany).not.toHaveBeenCalled();
  });

  it("returns only verified orders", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findMany).mockResolvedValue([
      {
        id: 15,
        orderNo: "CUT-0015",
        status: "VERIFIED",
        targetQty: 50,
        fabricRollId: "ROLL-001",
        actualFabricYds: 90,
        updatedAt: new Date("2026-10-07T01:00:00.000Z"),
        recipe: {
          recipeCode: "REC-BL01",
          name: "Casual Blouse",
        },
      },
    ] as never);

    const response = await GET();

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toEqual({
      orders: [
        {
          id: 15,
          orderNo: "CUT-0015",
          status: "VERIFIED",
          targetQty: 50,
          fabricRollId: "ROLL-001",
          actualFabricYds: 90,
          recipe: {
            recipeCode: "REC-BL01",
            name: "Casual Blouse",
          },
          verifiedAt: "2026-10-07T01:00:00.000Z",
        },
      ],
    });

    expect(prisma.cuttingOrder.findMany).toHaveBeenCalledWith({
      where: {
        status: "VERIFIED",
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        recipe: {
          select: {
            recipeCode: true,
            name: true,
          },
        },
      },
    });
  });

  it("returns an empty queue when there are no verified orders", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findMany).mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toEqual({
      orders: [],
    });
  });
});
