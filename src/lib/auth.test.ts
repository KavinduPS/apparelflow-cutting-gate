import { describe, it, expect, vi, beforeEach } from "vitest";
import { signToken, verifyToken, requireRole, COOKIE_NAME } from "./auth";
import { prisma } from "@/db/client";
import { cookies } from "next/headers";

// Mock dependencies
vi.mock("@/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("Authentication & Role Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies a token signed with the secret and returns the user id", async () => {
    const token = await signToken(42);
    const result = await verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(42);
  });

  it("rejects a token signed with a different secret", async () => {
    const differentSecret = "completely_different_secret_key_at_least_32_bytes";
    const token = await signToken(42, { secret: differentSecret });
    const result = await verifyToken(token);
    expect(result).toBeNull();
  });

  it("rejects an expired token", async () => {
    // Generate an expired token with negative expiration time
    const token = await signToken(42, { expiresIn: "-1s" });
    const result = await verifyToken(token);
    expect(result).toBeNull();
  });

  describe("requireRole", () => {
    it("returns 401 when there is no session", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      const auth = await requireRole(["cutting_verifier"]);
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(401);
        const data = await auth.response.json();
        expect(data).toEqual({ error: "Unauthorized" });
      }
    });

    it("returns 403 when the role is not allowed", async () => {
      const token = await signToken(10);
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockImplementation((name: string) => {
          if (name === COOKIE_NAME) return { value: token, name: COOKIE_NAME };
          return undefined;
        }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 10,
        email: "supervisor@apparelflow.test",
        fullName: "Cutting Supervisor",
        role: "cutting_supervisor",
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

      const auth = await requireRole(["cutting_verifier"]);
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(403);
        const data = await auth.response.json();
        expect(data).toEqual({ error: "Forbidden" });
      }
    });

    it("returns ok with user when the role is allowed", async () => {
      const token = await signToken(20);
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockImplementation((name: string) => {
          if (name === COOKIE_NAME) return { value: token, name: COOKIE_NAME };
          return undefined;
        }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 20,
        email: "verifier@apparelflow.test",
        fullName: "Cutting Verifier",
        role: "cutting_verifier",
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

      const auth = await requireRole(["cutting_verifier"]);
      expect(auth.ok).toBe(true);
      if (auth.ok) {
        expect(auth.user.id).toBe(20);
        expect(auth.user.role).toBe("cutting_verifier");
        expect(auth.user.fullName).toBe("Cutting Verifier");
      }
    });
  });
});
