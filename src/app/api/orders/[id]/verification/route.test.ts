import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/db/client";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    cuttingOrder: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("POST /api/orders/[id]/verification", () => {
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

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when the user is not a cutting verifier", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
    });

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 422 when rejecting without a reason", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECTED",
        items: [
          {
            componentId: 1,
            actualQty: 50,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data.error).toBe(
      "Rejection note is required when rejecting an order",
    );

    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
  });

  it("blocks approval when a component has a shortage", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 1,
      orderNo: "CUT-0001",
      targetQty: 50,
      actualFabricYds: 90,
      status: "PENDING_VERIFICATION",
      recipe: {
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
      },
      verificationItems: [
        {
          id: 1,
          componentId: 1,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
        {
          id: 2,
          componentId: 2,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
      ],
    } as never);

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVED",
        items: [
          {
            componentId: 1,
            actualQty: 45,
          },
          {
            componentId: 2,
            actualQty: 50,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data.error).toBe("Approval blocked");

    expect(data.reason).toBe(
      "One or more components are missing or below the expected quantity",
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("approves an order when all components pass verification", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 1,
      orderNo: "CUT-0001",
      targetQty: 50,
      actualFabricYds: 90,
      status: "PENDING_VERIFICATION",
      recipe: {
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
      },
      verificationItems: [
        {
          id: 1,
          componentId: 1,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
        {
          id: 2,
          componentId: 2,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
      ],
    } as never);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        verificationItem: {
          update: vi.fn().mockResolvedValue({}),
        },
        cuttingOrder: {
          update: vi.fn().mockResolvedValue({}),
        },
        verificationLog: {
          create: vi.fn().mockResolvedValue({
            id: 10,
            decision: "APPROVED",
            wastagePct: 0,
            timestamp: new Date("2026-10-06T10:00:00.000Z"),
          }),
        },
      };

      return callback(tx as never);
    });

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVED",
        items: [
          {
            componentId: 1,
            actualQty: 50,
          },
          {
            componentId: 2,
            actualQty: 50,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data.order).toEqual({
      id: 1,
      orderNo: "CUT-0001",
      status: "VERIFIED",
    });

    expect(data.verificationLog.decision).toBe("APPROVED");
    expect(data.verificationLog.wastagePct).toBe(0);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("blocks approval when fabric wastage exceeds the cap", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 1,
      orderNo: "CUT-0001",
      targetQty: 50,
      actualFabricYds: 100,
      status: "PENDING_VERIFICATION",
      recipe: {
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
      },
      verificationItems: [
        {
          id: 1,
          componentId: 1,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
        {
          id: 2,
          componentId: 2,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
      ],
    } as never);

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVED",
        items: [
          {
            componentId: 1,
            actualQty: 50,
          },
          {
            componentId: 2,
            actualQty: 50,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data.error).toBe("Approval blocked");
    expect(data.reason).toBe("Fabric wastage exceeds the recipe cap");
    expect(data.wastagePct).toBe(11.11);
    expect(data.wastageCap).toBe(5);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an order when a rejection reason is provided", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 1,
      orderNo: "CUT-0001",
      targetQty: 50,
      actualFabricYds: 92,
      status: "PENDING_VERIFICATION",
      recipe: {
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
      },
      verificationItems: [
        {
          id: 1,
          componentId: 1,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
        {
          id: 2,
          componentId: 2,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
      ],
    } as never);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        verificationItem: {
          update: vi.fn().mockResolvedValue({}),
        },
        cuttingOrder: {
          update: vi.fn().mockResolvedValue({}),
        },
        verificationLog: {
          create: vi.fn().mockResolvedValue({
            id: 11,
            decision: "REJECTED",
            wastagePct: 2.22,
            timestamp: new Date("2026-10-06T10:00:00.000Z"),
          }),
        },
      };

      return callback(tx as never);
    });

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "REJECTED",
        rejectionNote: "Back panel count is below the required quantity.",
        items: [
          {
            componentId: 1,
            actualQty: 50,
          },
          {
            componentId: 2,
            actualQty: 45,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data.order).toEqual({
      id: 1,
      orderNo: "CUT-0001",
      status: "REJECTED",
    });

    expect(data.verificationLog.decision).toBe("REJECTED");
    expect(data.verificationLog.wastagePct).toBe(2.22);

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("returns 422 when verification does not include every component", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        email: "verifier@test.com",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 1,
      orderNo: "CUT-0001",
      targetQty: 50,
      actualFabricYds: 90,
      status: "PENDING_VERIFICATION",
      recipe: {
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
      },
      verificationItems: [
        {
          id: 1,
          componentId: 1,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
        {
          id: 2,
          componentId: 2,
          expectedQty: 50,
          actualQty: null,
          status: null,
        },
      ],
    } as never);

    const request = new Request("http://localhost/api/orders/1/verification", {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVED",
        items: [
          {
            componentId: 1,
            actualQty: 50,
          },
        ],
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(422);

    const data = await response.json();

    expect(data.error).toBe("Verification must include every recipe component");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
