import { NextResponse } from "next/server";
import { cookies } from "next/headers";
// @ts-expect-error bcrypt has no bundled types
import bcrypt from "bcrypt";
import { prisma } from "@/db/client";
import { loginSchema } from "@/lib/validation/auth";
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DUMMY_HASH =
  "$2b$10$b7Zm0hM6bu9XoRlse0L8XOO7JD4/C8kvo2CrUOtECy3pAylujkvaC";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 422 }
    );
  }

  const parseResult = loginSchema.safeParse(body);
  if (!parseResult.success) {
    const fieldErrors = parseResult.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "Validation failed", details: fieldErrors },
      { status: 422 }
    );
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      passwordHash: true,
    },
  });

  let passwordMatch = false;
  if (user) {
    passwordMatch = await bcrypt.compare(password, user.passwordHash);
  } else {
    // Run comparison against dummy hash to prevent timing attacks
    await bcrypt.compare(password, DUMMY_HASH);
  }

  if (!user || !passwordMatch) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);

  return NextResponse.json({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
  });
}
