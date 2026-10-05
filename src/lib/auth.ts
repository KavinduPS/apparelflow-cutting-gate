import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import type { Role } from "@/generated/prisma/enums";

export const COOKIE_NAME = "af_session";
const SESSION_EXPIRATION = "8h";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60, // 8 hours in seconds
};

export function getJwtSecretKey(overrideSecret?: string): Uint8Array {
  const secret = overrideSecret ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

// Fail fast on module load if JWT_SECRET is not configured properly in non-test environments
if (process.env.NODE_ENV !== "test") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long.");
  }
}

export async function signToken(
  userId: number,
  options?: { secret?: string; expiresIn?: string }
): Promise<string> {
  const secretKey = getJwtSecretKey(options?.secret);
  return await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(options?.expiresIn ?? SESSION_EXPIRATION)
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
  customSecret?: string
): Promise<{ userId: number } | null> {
  try {
    const secretKey = getJwtSecretKey(customSecret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (!payload.sub) {
      return null;
    }

    const userId = parseInt(payload.sub, 10);
    if (isNaN(userId)) {
      return null;
    }

    return { userId };
  } catch {
    return null;
  }
}

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const verified = await verifyToken(token);
    if (!verified) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}

export type RoleGuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export async function requireRole(allowed: Role[]): Promise<RoleGuardResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!allowed.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}

export function getRoleLandingPath(role: Role): string {
  switch (role) {
    case "cutting_supervisor":
      return "/supervisor";
    case "cutting_verifier":
      return "/verifier";
    case "sewing_supervisor":
      return "/sewing";
  }
}
