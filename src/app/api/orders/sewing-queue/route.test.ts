import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/db/client";
import { ItemStatus, OrderStatus } from "@/generated/prisma/enums";

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
        id: 1,
        orderNo: "CUT-0001",
        status: OrderStatus.VERIFIED,
        targetQty: 100,
        fabricRollId: "ROLL-01",
        actualFabricYds: 180,
        updatedAt: new Date(),

        recipe: {
          recipeCode: "REC-BL01",
          name: "Casual Blouse",
        },

        verificationItems: [
          {
            componentId: 1,
            expectedQty: 100,
            actualQty: 100,
            status: ItemStatus.GREEN,
            component: {
              componentName: "Front Panel",
            },
          },
        ],

        verificationLogs: [
          {
            timestamp: new Date("2026-10-06T10:00:00Z"),
            wastagePct: 3.25,
            verifier: {
              id: 2,
              fullName: "Test Verifier",
            },
          },
        ],
      },
    ] as never);

    const response = await GET();

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toEqual({
      orders: [
        {
          id: 1,
          orderNo: "CUT-0001",
          status: "VERIFIED",
          targetQty: 100,
          fabricRollId: "ROLL-01",
          actualFabricYds: 180,
          recipe: {
            recipeCode: "REC-BL01",
            name: "Casual Blouse",
          },
          verificationItems: [
            {
              componentId: 1,
              componentName: "Front Panel",
              expectedQty: 100,
              actualQty: 100,
              status: "GREEN",
            },
          ],
          verification: {
            verifierId: 2,
            verifierName: "Test Verifier",
            verifiedAt: "2026-10-06T10:00:00.000Z",
            wastagePct: 3.25,
          },
          verifiedAt: "2026-10-06T10:00:00.000Z",
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
        verificationItems: {
          include: {
            component: {
              select: {
                componentName: true,
              },
            },
          },
          orderBy: {
            componentId: "asc",
          },
        },
        verificationLogs: {
          where: {
            decision: "APPROVED",
          },
          orderBy: {
            timestamp: "desc",
          },
          take: 1,
          include: {
            verifier: {
              select: {
                id: true,
                fullName: true,
              },
            },
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
