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
      updateMany: vi.fn(),
    },
  },
}));

describe("POST /api/orders/[id]/start-sewing", () => {
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

    const response = await POST(
      new Request("http://localhost/api/orders/15/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "15" }),
      },
    );

    expect(response.status).toBe(401);
    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
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

    const response = await POST(
      new Request("http://localhost/api/orders/15/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "15" }),
      },
    );

    expect(response.status).toBe(403);
    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
  });

  it("returns 422 when the order ID is invalid", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/orders/abc/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "abc" }),
      },
    );

    expect(response.status).toBe(422);
    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the order does not exist", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/orders/999/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "999" }),
      },
    );

    expect(response.status).toBe(404);
    expect(prisma.cuttingOrder.updateMany).not.toHaveBeenCalled();
  });

  it("returns 409 when the order is not verified", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 15,
      orderNo: "CUT-0015",
      status: "PENDING_VERIFICATION",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/orders/15/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "15" }),
      },
    );

    expect(response.status).toBe(409);
    expect(prisma.cuttingOrder.updateMany).not.toHaveBeenCalled();
  });

  it("starts sewing for a verified order", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 15,
      orderNo: "CUT-0015",
      status: "VERIFIED",
    } as never);

    vi.mocked(prisma.cuttingOrder.updateMany).mockResolvedValue({
      count: 1,
    });

    const response = await POST(
      new Request("http://localhost/api/orders/15/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "15" }),
      },
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data).toEqual({
      order: {
        id: 15,
        orderNo: "CUT-0015",
        status: "IN_SEWING",
      },
    });

    expect(prisma.cuttingOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 15,
        status: "VERIFIED",
      },
      data: {
        status: "IN_SEWING",
      },
    });
  });

  it("returns 409 when the conditional update does not change the order", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: {
        id: 3,
        email: "sewing@test.com",
        fullName: "Sewing Supervisor",
        role: "sewing_supervisor",
      },
    });

    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 15,
      orderNo: "CUT-0015",
      status: "VERIFIED",
    } as never);

    vi.mocked(prisma.cuttingOrder.updateMany).mockResolvedValue({
      count: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/orders/15/start-sewing", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "15" }),
      },
    );

    expect(response.status).toBe(409);
  });
});
